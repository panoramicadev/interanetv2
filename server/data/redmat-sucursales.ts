/**
 * Las ferreterías de la cadena REDMAT, tal como las mandó Daniel Hermosilla
 * (dhermosilla@pinturaspanoramica.cl) el 1 de septiembre de 2026, hoja
 * "PREFIJOS" del archivo "DETALLE REDMAT.xlsx".
 *
 * Son 17, no 18: los prefijos saltan de 011 a 016 y de 023 a 028, entre otros.
 *
 * El `prefijo` es con lo que la sucursal numera sus órdenes de compra y es el
 * único dato que la separa de sus hermanas: toda la cadena factura con el RUT
 * 77691044-9 y un solo código de cliente del ERP.
 *
 * `vendedor` es el código del ERP (kofuen). Coelemu queda sin vendedor a
 * pedido del cliente ("DEJAR LA OPCIÓN PARA ASOCIAR"): se asigna desde el panel.
 */

export const REDMAT_RUT = '77691044-9';

export interface SucursalCadena {
  prefijo: string;
  nombre: string;
  comuna: string;
  direccion: string;
  email: string | null;
  vendedor: string | null;
}

export const REDMAT_SUCURSALES: SucursalCadena[] = [
  { prefijo: '007', nombre: 'GALPON DE LA CONSTRUCCION',      comuna: 'COELEMU',                   direccion: 'Pedro Leon Gallo 372, Coelemu',                          email: 'jantoniocarvallo@yahoo.es',        vendedor: null },
  { prefijo: '008', nombre: 'FERRETERIA LA ITALIANA',         comuna: 'CAÑETE',                    direccion: 'Villagran 1080, Cañete',                                 email: 'empresas.laitaliana@gmail.com',    vendedor: 'PSV' },
  { prefijo: '009', nombre: 'FERRETERIA CHAVEZ CABRERO',      comuna: 'CABRERO',                   direccion: 'Tucapel 214, Cabrero',                                   email: 'jc.chavezc19@gmail.com',           vendedor: 'OSA' },
  { prefijo: '010', nombre: 'FERRETERIA CHAVEZ YUMBEL',       comuna: 'YUMBEL',                    direccion: 'Anibal Pinto 785',                                       email: 'jc.chavezc19@gmail.com',           vendedor: 'OSA' },
  { prefijo: '011', nombre: 'FERRETERIA CHAVEZ MONTE AGUILA', comuna: 'MONTE AGUILA',              direccion: 'Carlos Viel 150',                                        email: 'jc.chavezc19@gmail.com',           vendedor: 'OSA' },
  { prefijo: '016', nombre: 'CONSTRUCENTER MULCHEN',          comuna: 'MULCHEN',                   direccion: 'Barros arana 477',                                       email: 'amunoz@ccenterchile.com',          vendedor: 'PSV' },
  { prefijo: '017', nombre: 'CONSTRUCENTER NACIMIENTO',       comuna: 'NACIMIENTO',                direccion: 'Villa alegre 1681',                                      email: 'construcenter.ltda@gmail.com',     vendedor: 'PSV' },
  { prefijo: '018', nombre: 'FERRETERIA LA ITALIANA 2',       comuna: 'LOS ALAMOS',                direccion: 'Calle Libertad 443',                                     email: 'empresas.laitaliana@gmail.com',    vendedor: 'PSV' },
  { prefijo: '019', nombre: 'FERRETERIA LA ITALIANA 3',       comuna: 'CAÑETE',                    direccion: 'Tucapel Alto km 4,5, paradero 9 1/2 (bodega)',           email: 'empresas.laitaliana@gmail.com',    vendedor: 'PSV' },
  { prefijo: '022', nombre: 'FERRETERIA SAN ALEJANDRO',       comuna: 'NEGRETE',                   direccion: 'Ruta Q-80 Hijuela La Turbina Lote 2-A Coihue',           email: 'dcontreras@coimsachile.cl',        vendedor: 'PSV' },
  { prefijo: '023', nombre: 'FERRETERIA LA ITALIANA 4',       comuna: 'QUIRIHUE',                  direccion: 'Carrera 1096',                                           email: 'empresas.laitaliana@gmail.com',    vendedor: 'PSV' },
  { prefijo: '028', nombre: 'FERRETERIA FLANDEZ',             comuna: 'PAILLACO',                  direccion: 'Vicuña Mackena 1140',                                   email: 'ferreteriaflandez@gmail.com',      vendedor: 'CLC' },
  { prefijo: '030', nombre: 'FERRETERIA MOLL SAN JOSE',       comuna: 'SAN JOSE DE LA MARIQUINA',  direccion: 'Mariquina 1745',                                         email: 'mollpach@hotmail.com',             vendedor: 'CLC' },
  { prefijo: '031', nombre: 'FERRIMAT',                       comuna: 'SAN PEDRO DE LA PAZ',       direccion: 'Victoria 255, Lomas Coloradas',                          email: 'solave@cferrimat.cl',              vendedor: 'OSA' },
  { prefijo: '033', nombre: 'FERRETERIA MOLL VALDIVIA',       comuna: 'VALDIVIA',                  direccion: 'Chacabuco 765',                                          email: 'mollpach@hotmail.com',             vendedor: 'CLC' },
  { prefijo: '036', nombre: 'EL SURCO MELIPEUCO',             comuna: 'MELIPEUCO',                 direccion: 'Av Pedro Aguirre Cerda 536',                             email: 'gerencia@ferreteriaelsurco.cl',    vendedor: 'PSV' },
  { prefijo: '039', nombre: 'EL SURCO CUNCO',                 comuna: 'CUNCO',                     direccion: 'Av Llaima 645, Cunco',                                   email: 'gerencia@ferreteriaelsurco.cl',    vendedor: 'PSV' },
];
