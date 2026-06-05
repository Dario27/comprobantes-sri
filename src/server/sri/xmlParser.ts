import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { childLogger } from '../logging';

const log = childLogger('sri:xmlParser');

export type TipoComprobanteDetalle =
  | 'factura' | 'retencion' | 'nota_credito' | 'nota_debito' | 'liquidacion';

export interface ParsedMeta {
  tipo: TipoComprobanteDetalle;
  ambiente?: string;
  estado?: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  fechaEmision?: string;
  secuencial?: string;
}

export interface ParsedEmisor {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccionMatriz?: string;
  direccionEstablecimiento?: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad?: string;
}

export interface ParsedReceptor {
  tipoIdentificacion?: string;
  identificacion: string;
  razonSocial: string;
  direccion?: string;
}

export interface ParsedTotales {
  subtotalSinImpuestos?: number;
  descuento?: number;
  iva?: number;
  propina?: number;
  importeTotal: number;
  moneda?: string;
}

export interface ParsedImpuesto {
  codigo: string;
  codigoPorcentaje: string;
  baseImponible: number;
  valor: number;
}

export interface ParsedDetalle {
  codigoPrincipal?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  precioTotalSinImpuesto: number;
}

export interface ParsedComprobante {
  meta: ParsedMeta;
  emisor: ParsedEmisor;
  receptor: ParsedReceptor;
  totales: ParsedTotales;
  impuestos?: ParsedImpuesto[];
  detalles?: ParsedDetalle[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
});

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) {
    log.warn({ raw: v }, 'monto_invalido');
    return undefined;
  }
  return n;
}

function numReq(v: unknown, field: string): number {
  const n = num(v);
  if (n === undefined) {
    log.warn({ field, raw: v }, 'monto_requerido_invalido');
    return 0;
  }
  return n;
}

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function strReq(v: unknown): string {
  return str(v) ?? '';
}

// "12/05/2026" -> "2026-05-12"; "2026-05-12" se mantiene.
function normalizeFechaEmision(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

// "001", "001", "000000001" -> "001-001-000000001"
function buildSecuencial(estab: unknown, ptoEmi: unknown, sec: unknown): string | undefined {
  const e = str(estab);
  const p = str(ptoEmi);
  const s = str(sec);
  if (!e || !p || !s) return undefined;
  return `${e}-${p}-${s.padStart(9, '0')}`;
}

interface RawDoc {
  factura?: unknown;
  comprobanteRetencion?: unknown;
  notaCredito?: unknown;
  notaDebito?: unknown;
  liquidacionCompra?: unknown;
  autorizacion?: { estado?: string; numeroAutorizacion?: string; fechaAutorizacion?: string; comprobante?: string };
}

function unwrapAutorizacion(raw: RawDoc): { inner: RawDoc; envelope?: NonNullable<RawDoc['autorizacion']> } {
  if (!raw.autorizacion?.comprobante) return { inner: raw };
  const innerStr = String(raw.autorizacion.comprobante);
  const validation = XMLValidator.validate(innerStr);
  if (validation !== true) {
    throw new Error(`XML inválido: ${(validation as { err: { msg: string } }).err.msg}`);
  }
  const inner = parser.parse(innerStr) as RawDoc;
  return { inner, envelope: raw.autorizacion };
}

function mapFactura(doc: any, envelope: any): ParsedComprobante {
  const it = doc.factura?.infoTributaria ?? {};
  const inf = doc.factura?.infoFactura ?? {};
  const detalles = asArray<any>(doc.factura?.detalles?.detalle);
  const impuestos = asArray<any>(inf.totalConImpuestos?.totalImpuesto).map((i) => ({
    codigo: strReq(i.codigo),
    codigoPorcentaje: strReq(i.codigoPorcentaje),
    baseImponible: numReq(i.baseImponible, 'baseImponible'),
    valor: numReq(i.valor, 'valor')
  }));
  const iva = impuestos.filter((i) => i.codigo === '2').reduce((s, i) => s + i.valor, 0);
  return {
    meta: {
      tipo: 'factura',
      ambiente: str(it.ambiente),
      estado: str(envelope?.estado),
      numeroAutorizacion: str(envelope?.numeroAutorizacion),
      fechaAutorizacion: str(envelope?.fechaAutorizacion),
      fechaEmision: normalizeFechaEmision(inf.fechaEmision),
      secuencial: buildSecuencial(it.estab, it.ptoEmi, it.secuencial)
    },
    emisor: {
      ruc: strReq(it.ruc),
      razonSocial: strReq(it.razonSocial),
      nombreComercial: str(it.nombreComercial),
      direccionMatriz: str(it.dirMatriz),
      direccionEstablecimiento: str(inf.dirEstablecimiento),
      contribuyenteEspecial: str(inf.contribuyenteEspecial),
      obligadoContabilidad: str(inf.obligadoContabilidad)
    },
    receptor: {
      tipoIdentificacion: str(inf.tipoIdentificacionComprador),
      identificacion: strReq(inf.identificacionComprador),
      razonSocial: strReq(inf.razonSocialComprador),
      direccion: str(inf.direccionComprador)
    },
    totales: {
      subtotalSinImpuestos: num(inf.totalSinImpuestos),
      descuento: num(inf.totalDescuento),
      iva: impuestos.length ? iva : undefined,
      propina: num(inf.propina),
      importeTotal: numReq(inf.importeTotal, 'importeTotal'),
      moneda: str(inf.moneda)
    },
    impuestos: impuestos.length ? impuestos : undefined,
    detalles: detalles.length
      ? detalles.map((d) => ({
          codigoPrincipal: str(d.codigoPrincipal),
          descripcion: strReq(d.descripcion),
          cantidad: numReq(d.cantidad, 'cantidad'),
          precioUnitario: numReq(d.precioUnitario, 'precioUnitario'),
          descuento: num(d.descuento),
          precioTotalSinImpuesto: numReq(d.precioTotalSinImpuesto, 'precioTotalSinImpuesto')
        }))
      : undefined
  };
}

function mapRetencion(doc: any, envelope: any): ParsedComprobante {
  const it = doc.comprobanteRetencion?.infoTributaria ?? {};
  const inf = doc.comprobanteRetencion?.infoCompRetencion ?? {};
  return {
    meta: {
      tipo: 'retencion',
      ambiente: str(it.ambiente),
      estado: str(envelope?.estado),
      numeroAutorizacion: str(envelope?.numeroAutorizacion),
      fechaAutorizacion: str(envelope?.fechaAutorizacion),
      fechaEmision: normalizeFechaEmision(inf.fechaEmision),
      secuencial: buildSecuencial(it.estab, it.ptoEmi, it.secuencial)
    },
    emisor: {
      ruc: strReq(it.ruc),
      razonSocial: strReq(it.razonSocial),
      nombreComercial: str(it.nombreComercial),
      direccionMatriz: str(it.dirMatriz),
      direccionEstablecimiento: str(inf.dirEstablecimiento),
      contribuyenteEspecial: str(inf.contribuyenteEspecial),
      obligadoContabilidad: str(inf.obligadoContabilidad)
    },
    receptor: {
      tipoIdentificacion: str(inf.tipoIdentificacionSujetoRetenido),
      identificacion: strReq(inf.identificacionSujetoRetenido),
      razonSocial: strReq(inf.razonSocialSujetoRetenido)
    },
    totales: { importeTotal: 0 }
  };
}

function mapNotaCredito(doc: any, envelope: any): ParsedComprobante {
  const it = doc.notaCredito?.infoTributaria ?? {};
  const inf = doc.notaCredito?.infoNotaCredito ?? {};
  const impuestos = asArray<any>(inf.totalConImpuestos?.totalImpuesto).map((i) => ({
    codigo: strReq(i.codigo),
    codigoPorcentaje: strReq(i.codigoPorcentaje),
    baseImponible: numReq(i.baseImponible, 'baseImponible'),
    valor: numReq(i.valor, 'valor')
  }));
  const iva = impuestos.filter((i) => i.codigo === '2').reduce((s, i) => s + i.valor, 0);
  return {
    meta: {
      tipo: 'nota_credito',
      ambiente: str(it.ambiente),
      estado: str(envelope?.estado),
      numeroAutorizacion: str(envelope?.numeroAutorizacion),
      fechaAutorizacion: str(envelope?.fechaAutorizacion),
      fechaEmision: normalizeFechaEmision(inf.fechaEmision),
      secuencial: buildSecuencial(it.estab, it.ptoEmi, it.secuencial)
    },
    emisor: {
      ruc: strReq(it.ruc),
      razonSocial: strReq(it.razonSocial),
      nombreComercial: str(it.nombreComercial),
      direccionMatriz: str(it.dirMatriz)
    },
    receptor: {
      tipoIdentificacion: str(inf.tipoIdentificacionComprador),
      identificacion: strReq(inf.identificacionComprador),
      razonSocial: strReq(inf.razonSocialComprador)
    },
    totales: {
      subtotalSinImpuestos: num(inf.totalSinImpuestos),
      iva: impuestos.length ? iva : undefined,
      importeTotal: numReq(inf.valorModificacion, 'valorModificacion'),
      moneda: str(inf.moneda)
    },
    impuestos: impuestos.length ? impuestos : undefined
  };
}

function mapNotaDebito(doc: any, envelope: any): ParsedComprobante {
  const it = doc.notaDebito?.infoTributaria ?? {};
  const inf = doc.notaDebito?.infoNotaDebito ?? {};
  const impuestos = asArray<any>(inf.totalConImpuestos?.totalImpuesto).map((i) => ({
    codigo: strReq(i.codigo),
    codigoPorcentaje: strReq(i.codigoPorcentaje),
    baseImponible: numReq(i.baseImponible, 'baseImponible'),
    valor: numReq(i.valor, 'valor')
  }));
  const iva = impuestos.filter((i) => i.codigo === '2').reduce((s, i) => s + i.valor, 0);
  return {
    meta: {
      tipo: 'nota_debito',
      ambiente: str(it.ambiente),
      estado: str(envelope?.estado),
      numeroAutorizacion: str(envelope?.numeroAutorizacion),
      fechaAutorizacion: str(envelope?.fechaAutorizacion),
      fechaEmision: normalizeFechaEmision(inf.fechaEmision),
      secuencial: buildSecuencial(it.estab, it.ptoEmi, it.secuencial)
    },
    emisor: {
      ruc: strReq(it.ruc),
      razonSocial: strReq(it.razonSocial),
      nombreComercial: str(it.nombreComercial),
      direccionMatriz: str(it.dirMatriz)
    },
    receptor: {
      tipoIdentificacion: str(inf.tipoIdentificacionComprador),
      identificacion: strReq(inf.identificacionComprador),
      razonSocial: strReq(inf.razonSocialComprador)
    },
    totales: {
      subtotalSinImpuestos: num(inf.totalSinImpuestos),
      iva: impuestos.length ? iva : undefined,
      importeTotal: numReq(inf.valorTotal, 'valorTotal'),
      moneda: str(inf.moneda)
    },
    impuestos: impuestos.length ? impuestos : undefined
  };
}

function mapLiquidacion(doc: any, envelope: any): ParsedComprobante {
  const it = doc.liquidacionCompra?.infoTributaria ?? {};
  const inf = doc.liquidacionCompra?.infoLiquidacionCompra ?? {};
  const detalles = asArray<any>(doc.liquidacionCompra?.detalles?.detalle);
  const impuestos = asArray<any>(inf.totalConImpuestos?.totalImpuesto).map((i) => ({
    codigo: strReq(i.codigo),
    codigoPorcentaje: strReq(i.codigoPorcentaje),
    baseImponible: numReq(i.baseImponible, 'baseImponible'),
    valor: numReq(i.valor, 'valor')
  }));
  const iva = impuestos.filter((i) => i.codigo === '2').reduce((s, i) => s + i.valor, 0);
  return {
    meta: {
      tipo: 'liquidacion',
      ambiente: str(it.ambiente),
      estado: str(envelope?.estado),
      numeroAutorizacion: str(envelope?.numeroAutorizacion),
      fechaAutorizacion: str(envelope?.fechaAutorizacion),
      fechaEmision: normalizeFechaEmision(inf.fechaEmision),
      secuencial: buildSecuencial(it.estab, it.ptoEmi, it.secuencial)
    },
    emisor: {
      ruc: strReq(it.ruc),
      razonSocial: strReq(it.razonSocial),
      nombreComercial: str(it.nombreComercial),
      direccionMatriz: str(it.dirMatriz),
      direccionEstablecimiento: str(inf.dirEstablecimiento)
    },
    receptor: {
      tipoIdentificacion: str(inf.tipoIdentificacionProveedor),
      identificacion: strReq(inf.identificacionProveedor),
      razonSocial: strReq(inf.razonSocialProveedor),
      direccion: str(inf.direccionProveedor)
    },
    totales: {
      subtotalSinImpuestos: num(inf.totalSinImpuestos),
      descuento: num(inf.totalDescuento),
      iva: impuestos.length ? iva : undefined,
      propina: num(inf.propina),
      importeTotal: numReq(inf.importeTotal, 'importeTotal'),
      moneda: str(inf.moneda)
    },
    impuestos: impuestos.length ? impuestos : undefined,
    detalles: detalles.length
      ? detalles.map((d) => ({
          codigoPrincipal: str(d.codigoPrincipal),
          descripcion: strReq(d.descripcion),
          cantidad: numReq(d.cantidad, 'cantidad'),
          precioUnitario: numReq(d.precioUnitario, 'precioUnitario'),
          descuento: num(d.descuento),
          precioTotalSinImpuesto: numReq(d.precioTotalSinImpuesto, 'precioTotalSinImpuesto')
        }))
      : undefined
  };
}

export function parseComprobanteXml(blob: Buffer, tipoHint: TipoComprobanteDetalle): ParsedComprobante {
  if (!blob || blob.length === 0) {
    throw new Error('XML vacío: el comprobante no contiene datos.');
  }
  const xmlStr = blob.toString('utf-8');
  const validation = XMLValidator.validate(xmlStr);
  if (validation !== true) {
    throw new Error(`XML inválido: ${(validation as { err: { msg: string } }).err.msg}`);
  }
  let raw: RawDoc;
  try {
    raw = parser.parse(xmlStr) as RawDoc;
  } catch (e) {
    throw new Error(`XML inválido: ${(e as Error).message}`);
  }

  const { inner, envelope } = unwrapAutorizacion(raw);

  if (inner.factura) return mapFactura(inner, envelope);
  if (inner.comprobanteRetencion) return mapRetencion(inner, envelope);
  if (inner.notaCredito) return mapNotaCredito(inner, envelope);
  if (inner.notaDebito) return mapNotaDebito(inner, envelope);
  if (inner.liquidacionCompra) return mapLiquidacion(inner, envelope);

  throw new Error(`XML sin nodo raíz reconocido (esperado: factura, comprobanteRetencion, notaCredito, notaDebito o liquidacionCompra). Tipo hint=${tipoHint}`);
}
