import fs from 'node:fs';
import { SriError } from '../errors';
import type { DbInstance } from '../storage/db';
import { parseComprobanteXml, type ParsedComprobante, type TipoComprobanteDetalle } from './xmlParser';
import { childLogger } from '../logging';

const log = childLogger('sri:comprobanteDetail');

export interface SessionContext {
  // companyId null = sin scope por empresa (bandeja del usuario final, sin sesión SRI).
  companyId: number | null;
}

export interface ComprobanteDetailResponse extends ParsedComprobante {
  meta: ParsedComprobante['meta'] & { claveAcceso: string };
}

const VALID_TIPOS: ReadonlySet<TipoComprobanteDetalle> = new Set([
  'factura', 'retencion', 'nota_credito', 'nota_debito', 'liquidacion'
]);

function resolveXmlBuffer(row: { xmlContent?: Buffer | null; xmlPath?: string | null; claveAcceso: string }): Buffer {
  if (row.xmlContent && row.xmlContent.length > 0) return row.xmlContent;
  if (row.xmlPath) {
    try {
      const buf = fs.readFileSync(row.xmlPath);
      log.warn({ claveAcceso: row.claveAcceso, xmlPath: row.xmlPath }, 'xml_leido_de_disco_fallback');
      return buf;
    } catch (e) {
      log.warn({ claveAcceso: row.claveAcceso, err: (e as Error).message }, 'xml_path_no_legible');
    }
  }
  throw new SriError('XML_MISSING', 'No se encontró el XML del comprobante (ni en base ni en disco).');
}

export function buildComprobanteDetail(
  db: DbInstance,
  session: SessionContext,
  claveAcceso: string
): ComprobanteDetailResponse {
  const row = session.companyId === null
    ? db.findByClaveAcceso(claveAcceso)
    : db.findDetailForSession(claveAcceso, session.companyId);
  if (!row) {
    throw new SriError('COMPROBANTE_NOT_FOUND', 'El comprobante no existe en la base.');
  }

  const tipoHint: TipoComprobanteDetalle = VALID_TIPOS.has(row.tipo as TipoComprobanteDetalle)
    ? (row.tipo as TipoComprobanteDetalle)
    : 'factura';

  const buffer = resolveXmlBuffer(row);

  let parsed: ParsedComprobante;
  try {
    parsed = parseComprobanteXml(buffer, tipoHint);
  } catch (e) {
    throw new SriError('XML_PARSE_FAILED', `No se pudo leer el XML del comprobante. Detalle: ${(e as Error).message}`, e);
  }

  return {
    ...parsed,
    meta: {
      ...parsed.meta,
      claveAcceso: row.claveAcceso,
      // Si la envoltura <autorizacion> no estaba en el XML, completa desde la BD.
      numeroAutorizacion: parsed.meta.numeroAutorizacion ?? row.numeroAutorizacion,
      fechaAutorizacion: parsed.meta.fechaAutorizacion ?? row.fechaAutorizacion,
      fechaEmision: parsed.meta.fechaEmision ?? row.fechaEmision
    }
  };
}
