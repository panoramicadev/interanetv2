-- 078 — Normalización geográfica: comunas y regiones canónicas de Chile.
--
-- Los campos comuna/región del CRM y de "Dónde Comprar" venían de texto libre y
-- de cuatro catálogos distintos, así que la misma región convivía escrita como
-- "ARAUCANIA", "ARAUCANÍA", "La Araucanía" y "La araucania", y había valores que
-- ni siquiera son de Chile ("NEUQUEN").
--
-- Esta migración deja el histórico alineado con @shared/chile-geo, que a partir
-- de ahora es el único catálogo (16 regiones, 346 comunas):
--   · comuna que resuelve  → se guarda canónica y la región se DERIVA de ella
--   · comuna que no resuelve → se conserva el texto y se normaliza sólo la región
--   · región que no es de Chile → queda en NULL
--
-- Lo que no resuelve queda listado en geo_backfill_pendientes para revisarlo a
-- mano; ahí se ve si hay que corregir el dato o sumar un alias al catálogo.
--
-- Este archivo se genera desde el catálogo TypeScript — no editar a mano las
-- tablas de mapeo de abajo.

BEGIN;

-- Misma normalización que normalizeGeoKey() en shared/chile-geo.ts: mayúsculas,
-- sin tildes ni diéresis, sin apóstrofes ni puntos, resto colapsado a espacios.
-- Los 5 caracteres finales del 'from' no tienen par en el 'to', así que
-- translate() los elimina en vez de reemplazarlos.
CREATE OR REPLACE FUNCTION geo_key(v text) RETURNS text AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          translate(
            upper(coalesce(v, '')),
            'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ''’`´.',
            'AAAAAEEEEIIIIOOOOOUUUUNC'
          ),
          '[^A-Z0-9]+', ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    ), ''
  );
$$ LANGUAGE sql IMMUTABLE;

-- Mapeos temporales: clave normalizada -> valor canónico.
CREATE TEMP TABLE geo_map_comuna (clave text PRIMARY KEY, comuna text NOT NULL, region text NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE geo_map_region (clave text PRIMARY KEY, region text NOT NULL) ON COMMIT DROP;

INSERT INTO geo_map_comuna (clave, comuna, region) VALUES
  ('ARICA', 'Arica', 'Arica y Parinacota'),
  ('CAMARONES', 'Camarones', 'Arica y Parinacota'),
  ('GENERAL LAGOS', 'General Lagos', 'Arica y Parinacota'),
  ('PUTRE', 'Putre', 'Arica y Parinacota'),
  ('ALTO HOSPICIO', 'Alto Hospicio', 'Tarapacá'),
  ('CAMINA', 'Camiña', 'Tarapacá'),
  ('COLCHANE', 'Colchane', 'Tarapacá'),
  ('HUARA', 'Huara', 'Tarapacá'),
  ('IQUIQUE', 'Iquique', 'Tarapacá'),
  ('PICA', 'Pica', 'Tarapacá'),
  ('POZO ALMONTE', 'Pozo Almonte', 'Tarapacá'),
  ('ANTOFAGASTA', 'Antofagasta', 'Antofagasta'),
  ('CALAMA', 'Calama', 'Antofagasta'),
  ('MARIA ELENA', 'María Elena', 'Antofagasta'),
  ('MEJILLONES', 'Mejillones', 'Antofagasta'),
  ('OLLAGUE', 'Ollagüe', 'Antofagasta'),
  ('SAN PEDRO DE ATACAMA', 'San Pedro de Atacama', 'Antofagasta'),
  ('SIERRA GORDA', 'Sierra Gorda', 'Antofagasta'),
  ('TALTAL', 'Taltal', 'Antofagasta'),
  ('TOCOPILLA', 'Tocopilla', 'Antofagasta'),
  ('ALTO DEL CARMEN', 'Alto del Carmen', 'Atacama'),
  ('CALDERA', 'Caldera', 'Atacama'),
  ('CHANARAL', 'Chañaral', 'Atacama'),
  ('COPIAPO', 'Copiapó', 'Atacama'),
  ('DIEGO DE ALMAGRO', 'Diego de Almagro', 'Atacama'),
  ('FREIRINA', 'Freirina', 'Atacama'),
  ('HUASCO', 'Huasco', 'Atacama'),
  ('TIERRA AMARILLA', 'Tierra Amarilla', 'Atacama'),
  ('VALLENAR', 'Vallenar', 'Atacama'),
  ('ANDACOLLO', 'Andacollo', 'Coquimbo'),
  ('CANELA', 'Canela', 'Coquimbo'),
  ('COMBARBALA', 'Combarbalá', 'Coquimbo'),
  ('COQUIMBO', 'Coquimbo', 'Coquimbo'),
  ('ILLAPEL', 'Illapel', 'Coquimbo'),
  ('LA HIGUERA', 'La Higuera', 'Coquimbo'),
  ('LA SERENA', 'La Serena', 'Coquimbo'),
  ('LOS VILOS', 'Los Vilos', 'Coquimbo'),
  ('MONTE PATRIA', 'Monte Patria', 'Coquimbo'),
  ('OVALLE', 'Ovalle', 'Coquimbo'),
  ('PAIHUANO', 'Paihuano', 'Coquimbo'),
  ('PUNITAQUI', 'Punitaqui', 'Coquimbo'),
  ('RIO HURTADO', 'Río Hurtado', 'Coquimbo'),
  ('SALAMANCA', 'Salamanca', 'Coquimbo'),
  ('VICUNA', 'Vicuña', 'Coquimbo'),
  ('ALGARROBO', 'Algarrobo', 'Valparaíso'),
  ('CABILDO', 'Cabildo', 'Valparaíso'),
  ('CALLE LARGA', 'Calle Larga', 'Valparaíso'),
  ('CARTAGENA', 'Cartagena', 'Valparaíso'),
  ('CASABLANCA', 'Casablanca', 'Valparaíso'),
  ('CATEMU', 'Catemu', 'Valparaíso'),
  ('CONCON', 'Concón', 'Valparaíso'),
  ('EL QUISCO', 'El Quisco', 'Valparaíso'),
  ('EL TABO', 'El Tabo', 'Valparaíso'),
  ('HIJUELAS', 'Hijuelas', 'Valparaíso'),
  ('ISLA DE PASCUA', 'Isla de Pascua', 'Valparaíso'),
  ('JUAN FERNANDEZ', 'Juan Fernández', 'Valparaíso'),
  ('LA CALERA', 'La Calera', 'Valparaíso'),
  ('LA CRUZ', 'La Cruz', 'Valparaíso'),
  ('LA LIGUA', 'La Ligua', 'Valparaíso'),
  ('LIMACHE', 'Limache', 'Valparaíso'),
  ('LLAY LLAY', 'Llay-Llay', 'Valparaíso'),
  ('LOS ANDES', 'Los Andes', 'Valparaíso'),
  ('NOGALES', 'Nogales', 'Valparaíso'),
  ('OLMUE', 'Olmué', 'Valparaíso'),
  ('PANQUEHUE', 'Panquehue', 'Valparaíso'),
  ('PAPUDO', 'Papudo', 'Valparaíso'),
  ('PETORCA', 'Petorca', 'Valparaíso'),
  ('PUCHUNCAVI', 'Puchuncaví', 'Valparaíso'),
  ('PUTAENDO', 'Putaendo', 'Valparaíso'),
  ('QUILLOTA', 'Quillota', 'Valparaíso'),
  ('QUILPUE', 'Quilpué', 'Valparaíso'),
  ('QUINTERO', 'Quintero', 'Valparaíso'),
  ('RINCONADA', 'Rinconada', 'Valparaíso'),
  ('SAN ANTONIO', 'San Antonio', 'Valparaíso'),
  ('SAN ESTEBAN', 'San Esteban', 'Valparaíso'),
  ('SAN FELIPE', 'San Felipe', 'Valparaíso'),
  ('SANTA MARIA', 'Santa María', 'Valparaíso'),
  ('SANTO DOMINGO', 'Santo Domingo', 'Valparaíso'),
  ('VALPARAISO', 'Valparaíso', 'Valparaíso'),
  ('VILLA ALEMANA', 'Villa Alemana', 'Valparaíso'),
  ('VINA DEL MAR', 'Viña del Mar', 'Valparaíso'),
  ('ZAPALLAR', 'Zapallar', 'Valparaíso'),
  ('ALHUE', 'Alhué', 'Metropolitana'),
  ('BUIN', 'Buin', 'Metropolitana'),
  ('CALERA DE TANGO', 'Calera de Tango', 'Metropolitana'),
  ('CERRILLOS', 'Cerrillos', 'Metropolitana'),
  ('CERRO NAVIA', 'Cerro Navia', 'Metropolitana'),
  ('COLINA', 'Colina', 'Metropolitana'),
  ('CONCHALI', 'Conchalí', 'Metropolitana'),
  ('CURACAVI', 'Curacaví', 'Metropolitana'),
  ('EL BOSQUE', 'El Bosque', 'Metropolitana'),
  ('EL MONTE', 'El Monte', 'Metropolitana'),
  ('ESTACION CENTRAL', 'Estación Central', 'Metropolitana'),
  ('HUECHURABA', 'Huechuraba', 'Metropolitana'),
  ('INDEPENDENCIA', 'Independencia', 'Metropolitana'),
  ('ISLA DE MAIPO', 'Isla de Maipo', 'Metropolitana'),
  ('LA CISTERNA', 'La Cisterna', 'Metropolitana'),
  ('LA FLORIDA', 'La Florida', 'Metropolitana'),
  ('LA GRANJA', 'La Granja', 'Metropolitana'),
  ('LA PINTANA', 'La Pintana', 'Metropolitana'),
  ('LA REINA', 'La Reina', 'Metropolitana'),
  ('LAMPA', 'Lampa', 'Metropolitana'),
  ('LAS CONDES', 'Las Condes', 'Metropolitana'),
  ('LO BARNECHEA', 'Lo Barnechea', 'Metropolitana'),
  ('LO ESPEJO', 'Lo Espejo', 'Metropolitana'),
  ('LO PRADO', 'Lo Prado', 'Metropolitana'),
  ('MACUL', 'Macul', 'Metropolitana'),
  ('MAIPU', 'Maipú', 'Metropolitana'),
  ('MARIA PINTO', 'María Pinto', 'Metropolitana'),
  ('MELIPILLA', 'Melipilla', 'Metropolitana'),
  ('NUNOA', 'Ñuñoa', 'Metropolitana'),
  ('PADRE HURTADO', 'Padre Hurtado', 'Metropolitana'),
  ('PAINE', 'Paine', 'Metropolitana'),
  ('PEDRO AGUIRRE CERDA', 'Pedro Aguirre Cerda', 'Metropolitana'),
  ('PENAFLOR', 'Peñaflor', 'Metropolitana'),
  ('PENALOLEN', 'Peñalolén', 'Metropolitana'),
  ('PIRQUE', 'Pirque', 'Metropolitana'),
  ('PROVIDENCIA', 'Providencia', 'Metropolitana'),
  ('PUDAHUEL', 'Pudahuel', 'Metropolitana'),
  ('PUENTE ALTO', 'Puente Alto', 'Metropolitana'),
  ('QUILICURA', 'Quilicura', 'Metropolitana'),
  ('QUINTA NORMAL', 'Quinta Normal', 'Metropolitana'),
  ('RECOLETA', 'Recoleta', 'Metropolitana'),
  ('RENCA', 'Renca', 'Metropolitana'),
  ('SAN BERNARDO', 'San Bernardo', 'Metropolitana'),
  ('SAN JOAQUIN', 'San Joaquín', 'Metropolitana'),
  ('SAN JOSE DE MAIPO', 'San José de Maipo', 'Metropolitana'),
  ('SAN MIGUEL', 'San Miguel', 'Metropolitana'),
  ('SAN PEDRO', 'San Pedro', 'Metropolitana'),
  ('SAN RAMON', 'San Ramón', 'Metropolitana'),
  ('SANTIAGO', 'Santiago', 'Metropolitana'),
  ('TALAGANTE', 'Talagante', 'Metropolitana'),
  ('TIL TIL', 'Til Til', 'Metropolitana'),
  ('VITACURA', 'Vitacura', 'Metropolitana'),
  ('CHEPICA', 'Chépica', 'O''Higgins'),
  ('CHIMBARONGO', 'Chimbarongo', 'O''Higgins'),
  ('CODEGUA', 'Codegua', 'O''Higgins'),
  ('COINCO', 'Coinco', 'O''Higgins'),
  ('COLTAUCO', 'Coltauco', 'O''Higgins'),
  ('DONIHUE', 'Doñihue', 'O''Higgins'),
  ('GRANEROS', 'Graneros', 'O''Higgins'),
  ('LA ESTRELLA', 'La Estrella', 'O''Higgins'),
  ('LAS CABRAS', 'Las Cabras', 'O''Higgins'),
  ('LITUECHE', 'Litueche', 'O''Higgins'),
  ('LOLOL', 'Lolol', 'O''Higgins'),
  ('MACHALI', 'Machalí', 'O''Higgins'),
  ('MALLOA', 'Malloa', 'O''Higgins'),
  ('MARCHIGUE', 'Marchigüe', 'O''Higgins'),
  ('MOSTAZAL', 'Mostazal', 'O''Higgins'),
  ('NANCAGUA', 'Nancagua', 'O''Higgins'),
  ('NAVIDAD', 'Navidad', 'O''Higgins'),
  ('OLIVAR', 'Olivar', 'O''Higgins'),
  ('PALMILLA', 'Palmilla', 'O''Higgins'),
  ('PAREDONES', 'Paredones', 'O''Higgins'),
  ('PERALILLO', 'Peralillo', 'O''Higgins'),
  ('PEUMO', 'Peumo', 'O''Higgins'),
  ('PICHIDEGUA', 'Pichidegua', 'O''Higgins'),
  ('PICHILEMU', 'Pichilemu', 'O''Higgins'),
  ('PLACILLA', 'Placilla', 'O''Higgins'),
  ('PUMANQUE', 'Pumanque', 'O''Higgins'),
  ('QUINTA DE TILCOCO', 'Quinta de Tilcoco', 'O''Higgins'),
  ('RANCAGUA', 'Rancagua', 'O''Higgins'),
  ('RENGO', 'Rengo', 'O''Higgins'),
  ('REQUINOA', 'Requínoa', 'O''Higgins'),
  ('SAN FERNANDO', 'San Fernando', 'O''Higgins'),
  ('SAN VICENTE', 'San Vicente', 'O''Higgins'),
  ('SANTA CRUZ', 'Santa Cruz', 'O''Higgins'),
  ('CAUQUENES', 'Cauquenes', 'Maule'),
  ('CHANCO', 'Chanco', 'Maule'),
  ('COLBUN', 'Colbún', 'Maule'),
  ('CONSTITUCION', 'Constitución', 'Maule'),
  ('CUREPTO', 'Curepto', 'Maule'),
  ('CURICO', 'Curicó', 'Maule'),
  ('EMPEDRADO', 'Empedrado', 'Maule'),
  ('HUALANE', 'Hualañé', 'Maule'),
  ('LICANTEN', 'Licantén', 'Maule'),
  ('LINARES', 'Linares', 'Maule'),
  ('LONGAVI', 'Longaví', 'Maule'),
  ('MAULE', 'Maule', 'Maule'),
  ('MOLINA', 'Molina', 'Maule'),
  ('PARRAL', 'Parral', 'Maule'),
  ('PELARCO', 'Pelarco', 'Maule'),
  ('PELLUHUE', 'Pelluhue', 'Maule'),
  ('PENCAHUE', 'Pencahue', 'Maule'),
  ('RAUCO', 'Rauco', 'Maule'),
  ('RETIRO', 'Retiro', 'Maule'),
  ('RIO CLARO', 'Río Claro', 'Maule'),
  ('ROMERAL', 'Romeral', 'Maule'),
  ('SAGRADA FAMILIA', 'Sagrada Familia', 'Maule'),
  ('SAN CLEMENTE', 'San Clemente', 'Maule'),
  ('SAN JAVIER', 'San Javier', 'Maule'),
  ('SAN RAFAEL', 'San Rafael', 'Maule'),
  ('TALCA', 'Talca', 'Maule'),
  ('TENO', 'Teno', 'Maule'),
  ('VICHUQUEN', 'Vichuquén', 'Maule'),
  ('VILLA ALEGRE', 'Villa Alegre', 'Maule'),
  ('YERBAS BUENAS', 'Yerbas Buenas', 'Maule'),
  ('BULNES', 'Bulnes', 'Ñuble'),
  ('CHILLAN', 'Chillán', 'Ñuble'),
  ('CHILLAN VIEJO', 'Chillán Viejo', 'Ñuble'),
  ('COBQUECURA', 'Cobquecura', 'Ñuble'),
  ('COELEMU', 'Coelemu', 'Ñuble'),
  ('COIHUECO', 'Coihueco', 'Ñuble'),
  ('EL CARMEN', 'El Carmen', 'Ñuble'),
  ('NINHUE', 'Ninhue', 'Ñuble'),
  ('NIQUEN', 'Ñiquén', 'Ñuble'),
  ('PEMUCO', 'Pemuco', 'Ñuble'),
  ('PINTO', 'Pinto', 'Ñuble'),
  ('PORTEZUELO', 'Portezuelo', 'Ñuble'),
  ('QUILLON', 'Quillón', 'Ñuble'),
  ('QUIRIHUE', 'Quirihue', 'Ñuble'),
  ('RANQUIL', 'Ránquil', 'Ñuble'),
  ('SAN CARLOS', 'San Carlos', 'Ñuble'),
  ('SAN FABIAN', 'San Fabián', 'Ñuble'),
  ('SAN IGNACIO', 'San Ignacio', 'Ñuble'),
  ('SAN NICOLAS', 'San Nicolás', 'Ñuble'),
  ('TREGUACO', 'Treguaco', 'Ñuble'),
  ('YUNGAY', 'Yungay', 'Ñuble'),
  ('ALTO BIOBIO', 'Alto Biobío', 'Biobío'),
  ('ANTUCO', 'Antuco', 'Biobío'),
  ('ARAUCO', 'Arauco', 'Biobío'),
  ('CABRERO', 'Cabrero', 'Biobío'),
  ('CANETE', 'Cañete', 'Biobío'),
  ('CHIGUAYANTE', 'Chiguayante', 'Biobío'),
  ('CONCEPCION', 'Concepción', 'Biobío'),
  ('CONTULMO', 'Contulmo', 'Biobío'),
  ('CORONEL', 'Coronel', 'Biobío'),
  ('CURANILAHUE', 'Curanilahue', 'Biobío'),
  ('FLORIDA', 'Florida', 'Biobío'),
  ('HUALPEN', 'Hualpén', 'Biobío'),
  ('HUALQUI', 'Hualqui', 'Biobío'),
  ('LAJA', 'Laja', 'Biobío'),
  ('LEBU', 'Lebu', 'Biobío'),
  ('LOS ALAMOS', 'Los Álamos', 'Biobío'),
  ('LOS ANGELES', 'Los Ángeles', 'Biobío'),
  ('LOTA', 'Lota', 'Biobío'),
  ('MULCHEN', 'Mulchén', 'Biobío'),
  ('NACIMIENTO', 'Nacimiento', 'Biobío'),
  ('NEGRETE', 'Negrete', 'Biobío'),
  ('PENCO', 'Penco', 'Biobío'),
  ('QUILACO', 'Quilaco', 'Biobío'),
  ('QUILLECO', 'Quilleco', 'Biobío'),
  ('SAN PEDRO DE LA PAZ', 'San Pedro de la Paz', 'Biobío'),
  ('SAN ROSENDO', 'San Rosendo', 'Biobío'),
  ('SANTA BARBARA', 'Santa Bárbara', 'Biobío'),
  ('SANTA JUANA', 'Santa Juana', 'Biobío'),
  ('TALCAHUANO', 'Talcahuano', 'Biobío'),
  ('TIRUA', 'Tirúa', 'Biobío'),
  ('TOME', 'Tomé', 'Biobío'),
  ('TUCAPEL', 'Tucapel', 'Biobío'),
  ('YUMBEL', 'Yumbel', 'Biobío'),
  ('ANGOL', 'Angol', 'La Araucanía'),
  ('CARAHUE', 'Carahue', 'La Araucanía'),
  ('CHOLCHOL', 'Cholchol', 'La Araucanía'),
  ('COLLIPULLI', 'Collipulli', 'La Araucanía'),
  ('CUNCO', 'Cunco', 'La Araucanía'),
  ('CURACAUTIN', 'Curacautín', 'La Araucanía'),
  ('CURARREHUE', 'Curarrehue', 'La Araucanía'),
  ('ERCILLA', 'Ercilla', 'La Araucanía'),
  ('FREIRE', 'Freire', 'La Araucanía'),
  ('GALVARINO', 'Galvarino', 'La Araucanía'),
  ('GORBEA', 'Gorbea', 'La Araucanía'),
  ('LAUTARO', 'Lautaro', 'La Araucanía'),
  ('LONCOCHE', 'Loncoche', 'La Araucanía'),
  ('LONQUIMAY', 'Lonquimay', 'La Araucanía'),
  ('LOS SAUCES', 'Los Sauces', 'La Araucanía'),
  ('LUMACO', 'Lumaco', 'La Araucanía'),
  ('MELIPEUCO', 'Melipeuco', 'La Araucanía'),
  ('NUEVA IMPERIAL', 'Nueva Imperial', 'La Araucanía'),
  ('PADRE LAS CASAS', 'Padre Las Casas', 'La Araucanía'),
  ('PERQUENCO', 'Perquenco', 'La Araucanía'),
  ('PITRUFQUEN', 'Pitrufquén', 'La Araucanía'),
  ('PUCON', 'Pucón', 'La Araucanía'),
  ('PUREN', 'Purén', 'La Araucanía'),
  ('RENAICO', 'Renaico', 'La Araucanía'),
  ('SAAVEDRA', 'Saavedra', 'La Araucanía'),
  ('TEMUCO', 'Temuco', 'La Araucanía'),
  ('TEODORO SCHMIDT', 'Teodoro Schmidt', 'La Araucanía'),
  ('TOLTEN', 'Toltén', 'La Araucanía'),
  ('TRAIGUEN', 'Traiguén', 'La Araucanía'),
  ('VICTORIA', 'Victoria', 'La Araucanía'),
  ('VILCUN', 'Vilcún', 'La Araucanía'),
  ('VILLARRICA', 'Villarrica', 'La Araucanía'),
  ('CORRAL', 'Corral', 'Los Ríos'),
  ('FUTRONO', 'Futrono', 'Los Ríos'),
  ('LA UNION', 'La Unión', 'Los Ríos'),
  ('LAGO RANCO', 'Lago Ranco', 'Los Ríos'),
  ('LANCO', 'Lanco', 'Los Ríos'),
  ('LOS LAGOS', 'Los Lagos', 'Los Ríos'),
  ('MAFIL', 'Máfil', 'Los Ríos'),
  ('MARIQUINA', 'Mariquina', 'Los Ríos'),
  ('PAILLACO', 'Paillaco', 'Los Ríos'),
  ('PANGUIPULLI', 'Panguipulli', 'Los Ríos'),
  ('RIO BUENO', 'Río Bueno', 'Los Ríos'),
  ('VALDIVIA', 'Valdivia', 'Los Ríos'),
  ('ANCUD', 'Ancud', 'Los Lagos'),
  ('CALBUCO', 'Calbuco', 'Los Lagos'),
  ('CASTRO', 'Castro', 'Los Lagos'),
  ('CHAITEN', 'Chaitén', 'Los Lagos'),
  ('CHONCHI', 'Chonchi', 'Los Lagos'),
  ('COCHAMO', 'Cochamó', 'Los Lagos'),
  ('CURACO DE VELEZ', 'Curaco de Vélez', 'Los Lagos'),
  ('DALCAHUE', 'Dalcahue', 'Los Lagos'),
  ('FRESIA', 'Fresia', 'Los Lagos'),
  ('FRUTILLAR', 'Frutillar', 'Los Lagos'),
  ('FUTALEUFU', 'Futaleufú', 'Los Lagos'),
  ('HUALAIHUE', 'Hualaihué', 'Los Lagos'),
  ('LLANQUIHUE', 'Llanquihue', 'Los Lagos'),
  ('LOS MUERMOS', 'Los Muermos', 'Los Lagos'),
  ('MAULLIN', 'Maullín', 'Los Lagos'),
  ('OSORNO', 'Osorno', 'Los Lagos'),
  ('PALENA', 'Palena', 'Los Lagos'),
  ('PUERTO MONTT', 'Puerto Montt', 'Los Lagos'),
  ('PUERTO OCTAY', 'Puerto Octay', 'Los Lagos'),
  ('PUERTO VARAS', 'Puerto Varas', 'Los Lagos'),
  ('PUQUELDON', 'Puqueldón', 'Los Lagos'),
  ('PURRANQUE', 'Purranque', 'Los Lagos'),
  ('PUYEHUE', 'Puyehue', 'Los Lagos'),
  ('QUEILEN', 'Queilén', 'Los Lagos'),
  ('QUELLON', 'Quellón', 'Los Lagos'),
  ('QUEMCHI', 'Quemchi', 'Los Lagos'),
  ('QUINCHAO', 'Quinchao', 'Los Lagos'),
  ('RIO NEGRO', 'Río Negro', 'Los Lagos'),
  ('SAN JUAN DE LA COSTA', 'San Juan de la Costa', 'Los Lagos'),
  ('SAN PABLO', 'San Pablo', 'Los Lagos'),
  ('AYSEN', 'Aysén', 'Aysén'),
  ('CHILE CHICO', 'Chile Chico', 'Aysén'),
  ('CISNES', 'Cisnes', 'Aysén'),
  ('COCHRANE', 'Cochrane', 'Aysén'),
  ('COYHAIQUE', 'Coyhaique', 'Aysén'),
  ('GUAITECAS', 'Guaitecas', 'Aysén'),
  ('LAGO VERDE', 'Lago Verde', 'Aysén'),
  ('OHIGGINS', 'O''Higgins', 'Aysén'),
  ('RIO IBANEZ', 'Río Ibáñez', 'Aysén'),
  ('TORTEL', 'Tortel', 'Aysén'),
  ('ANTARTICA', 'Antártica', 'Magallanes'),
  ('CABO DE HORNOS', 'Cabo de Hornos', 'Magallanes'),
  ('LAGUNA BLANCA', 'Laguna Blanca', 'Magallanes'),
  ('NATALES', 'Natales', 'Magallanes'),
  ('PORVENIR', 'Porvenir', 'Magallanes'),
  ('PRIMAVERA', 'Primavera', 'Magallanes'),
  ('PUNTA ARENAS', 'Punta Arenas', 'Magallanes'),
  ('RIO VERDE', 'Río Verde', 'Magallanes'),
  ('SAN GREGORIO', 'San Gregorio', 'Magallanes'),
  ('TIMAUKEL', 'Timaukel', 'Magallanes'),
  ('TORRES DEL PAINE', 'Torres del Paine', 'Magallanes'),
  ('LLAILLAY', 'Llay-Llay', 'Valparaíso'),
  ('TILTIL', 'Til Til', 'Metropolitana'),
  ('PAIGUANO', 'Paihuano', 'Coquimbo'),
  ('TREHUACO', 'Treguaco', 'Ñuble'),
  ('MARCHIHUE', 'Marchigüe', 'O''Higgins'),
  ('COIHAIQUE', 'Coyhaique', 'Aysén'),
  ('AISEN', 'Aysén', 'Aysén'),
  ('PUERTO AYSEN', 'Aysén', 'Aysén'),
  ('PUERTO AISEN', 'Aysén', 'Aysén'),
  ('PUERTO NATALES', 'Natales', 'Magallanes'),
  ('PUERTO WILLIAMS', 'Cabo de Hornos', 'Magallanes'),
  ('SAN VICENTE DE TAGUA TAGUA', 'San Vicente', 'O''Higgins'),
  ('ALTO BIO BIO', 'Alto Biobío', 'Biobío'),
  ('CHOL CHOL', 'Cholchol', 'La Araucanía'),
  ('HANGA ROA', 'Isla de Pascua', 'Valparaíso'),
  ('CALERA', 'La Calera', 'Valparaíso'),
  ('SANTIAGO CENTRO', 'Santiago', 'Metropolitana'),
  ('PENA FLOR', 'Peñaflor', 'Metropolitana'),
  ('ANTARTICA CHILENA', 'Antártica', 'Magallanes'),
  ('PUERTO SAAVEDRA', 'Saavedra', 'La Araucanía'),
  ('SAN PEDRO DE LA COSTA', 'San Pedro', 'Metropolitana'),
  ('TEODORO SCHMITH', 'Teodoro Schmidt', 'La Araucanía'),
  ('PADRE LAS CASA', 'Padre Las Casas', 'La Araucanía');

INSERT INTO geo_map_region (clave, region) VALUES
  ('REGION DE ARICA Y PARINACOTA', 'Arica y Parinacota'),
  ('ARICA Y PARINACOTA', 'Arica y Parinacota'),
  ('XV', 'Arica y Parinacota'),
  ('REGION DE TARAPACA', 'Tarapacá'),
  ('TARAPACA', 'Tarapacá'),
  ('I', 'Tarapacá'),
  ('REGION DE ANTOFAGASTA', 'Antofagasta'),
  ('ANTOFAGASTA', 'Antofagasta'),
  ('II', 'Antofagasta'),
  ('REGION DE ATACAMA', 'Atacama'),
  ('ATACAMA', 'Atacama'),
  ('III', 'Atacama'),
  ('REGION DE COQUIMBO', 'Coquimbo'),
  ('COQUIMBO', 'Coquimbo'),
  ('IV', 'Coquimbo'),
  ('REGION DE VALPARAISO', 'Valparaíso'),
  ('VALPARAISO', 'Valparaíso'),
  ('V', 'Valparaíso'),
  ('REGION METROPOLITANA DE SANTIAGO', 'Metropolitana'),
  ('METROPOLITANA', 'Metropolitana'),
  ('RM', 'Metropolitana'),
  ('REGION DEL LIBERTADOR GENERAL BERNARDO OHIGGINS', 'O''Higgins'),
  ('OHIGGINS', 'O''Higgins'),
  ('VI', 'O''Higgins'),
  ('REGION DEL MAULE', 'Maule'),
  ('MAULE', 'Maule'),
  ('VII', 'Maule'),
  ('REGION DE NUBLE', 'Ñuble'),
  ('NUBLE', 'Ñuble'),
  ('XVI', 'Ñuble'),
  ('REGION DEL BIOBIO', 'Biobío'),
  ('BIOBIO', 'Biobío'),
  ('VIII', 'Biobío'),
  ('REGION DE LA ARAUCANIA', 'La Araucanía'),
  ('LA ARAUCANIA', 'La Araucanía'),
  ('IX', 'La Araucanía'),
  ('REGION DE LOS RIOS', 'Los Ríos'),
  ('LOS RIOS', 'Los Ríos'),
  ('XIV', 'Los Ríos'),
  ('REGION DE LOS LAGOS', 'Los Lagos'),
  ('LOS LAGOS', 'Los Lagos'),
  ('X', 'Los Lagos'),
  ('REGION DE AYSEN DEL GENERAL CARLOS IBANEZ DEL CAMPO', 'Aysén'),
  ('AYSEN', 'Aysén'),
  ('XI', 'Aysén'),
  ('REGION DE MAGALLANES Y DE LA ANTARTICA CHILENA', 'Magallanes'),
  ('MAGALLANES', 'Magallanes'),
  ('XII', 'Magallanes'),
  ('ARICA', 'Arica y Parinacota'),
  ('METROPOLITANA DE SANTIAGO', 'Metropolitana'),
  ('SANTIAGO', 'Metropolitana'),
  ('REGION METROPOLITANA', 'Metropolitana'),
  ('LIB GRAL BERNARDO OHIGGINS', 'O''Higgins'),
  ('LIBERTADOR BERNARDO OHIGGINS', 'O''Higgins'),
  ('LIBERTADOR GENERAL BERNARDO OHIGGINS', 'O''Higgins'),
  ('BERNARDO OHIGGINS', 'O''Higgins'),
  ('BIO BIO', 'Biobío'),
  ('ARAUCANIA', 'La Araucanía'),
  ('AYSEN DEL GENERAL CARLOS IBANEZ DEL CAMPO', 'Aysén'),
  ('AISEN', 'Aysén'),
  ('MAGALLANES Y ANTARTICA CHILENA', 'Magallanes'),
  ('MAGALLANES Y LA ANTARTICA CHILENA', 'Magallanes'),
  ('MAGALLANES Y DE LA ANTARTICA CHILENA', 'Magallanes');

-- Registro de lo que no se pudo clasificar, para revisión manual.
CREATE TABLE IF NOT EXISTS geo_backfill_pendientes (
  id SERIAL PRIMARY KEY,
  tabla VARCHAR(64) NOT NULL,
  campo VARCHAR(16) NOT NULL,
  valor TEXT NOT NULL,
  ocurrencias INTEGER NOT NULL,
  detectado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── crm_seguimiento_clientes ─────────────────────────────────────────

INSERT INTO geo_backfill_pendientes (tabla, campo, valor, ocurrencias)
SELECT 'crm_seguimiento_clientes', 'comuna', btrim(c.comuna), COUNT(*)
FROM crm_seguimiento_clientes c
WHERE geo_key(c.comuna) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM geo_map_comuna m WHERE m.clave = geo_key(c.comuna))
GROUP BY btrim(c.comuna);

INSERT INTO geo_backfill_pendientes (tabla, campo, valor, ocurrencias)
SELECT 'crm_seguimiento_clientes', 'region', btrim(c.region), COUNT(*)
FROM crm_seguimiento_clientes c
WHERE geo_key(c.region) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM geo_map_region m WHERE m.clave = geo_key(c.region))
GROUP BY btrim(c.region);

-- Comuna reconocida: manda ella y la región se deriva.
UPDATE crm_seguimiento_clientes c
SET comuna = m.comuna, region = m.region, updated_at = NOW()
FROM geo_map_comuna m
WHERE m.clave = geo_key(c.comuna)
  AND (c.comuna IS DISTINCT FROM m.comuna OR c.region IS DISTINCT FROM m.region);

-- Comuna no reconocida (o vacía): se conserva y sólo se canoniza la región.
UPDATE crm_seguimiento_clientes c
SET region = m.region, updated_at = NOW()
FROM geo_map_region m
WHERE m.clave = geo_key(c.region)
  AND NOT EXISTS (SELECT 1 FROM geo_map_comuna mc WHERE mc.clave = geo_key(c.comuna))
  AND c.region IS DISTINCT FROM m.region;

-- Región que no es de Chile ("NEUQUEN") o texto irreconocible: fuera.
UPDATE crm_seguimiento_clientes c
SET region = NULL, updated_at = NOW()
WHERE c.region IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM geo_map_comuna mc WHERE mc.clave = geo_key(c.comuna))
  AND NOT EXISTS (SELECT 1 FROM geo_map_region mr WHERE mr.clave = geo_key(c.region));

-- ─── retail_locations ("Dónde Comprar") ───────────────────────────────

INSERT INTO geo_backfill_pendientes (tabla, campo, valor, ocurrencias)
SELECT 'retail_locations', 'comuna', btrim(l.comuna), COUNT(*)
FROM retail_locations l
WHERE geo_key(l.comuna) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM geo_map_comuna m WHERE m.clave = geo_key(l.comuna))
GROUP BY btrim(l.comuna);

UPDATE retail_locations l
SET comuna = m.comuna, region = m.region
FROM geo_map_comuna m
WHERE m.clave = geo_key(l.comuna)
  AND (l.comuna IS DISTINCT FROM m.comuna OR l.region IS DISTINCT FROM m.region);

UPDATE retail_locations l
SET region = m.region
FROM geo_map_region m
WHERE m.clave = geo_key(l.region)
  AND NOT EXISTS (SELECT 1 FROM geo_map_comuna mc WHERE mc.clave = geo_key(l.comuna))
  AND l.region IS DISTINCT FROM m.region;

UPDATE retail_locations l
SET region = NULL
WHERE l.region IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM geo_map_comuna mc WHERE mc.clave = geo_key(l.comuna))
  AND NOT EXISTS (SELECT 1 FROM geo_map_region mr WHERE mr.clave = geo_key(l.region));

COMMIT;
