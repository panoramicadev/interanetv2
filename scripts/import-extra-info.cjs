/**
 * Import script: Reads the CSV from info-extra/ and populates:
 * 1. priceList (upsert by codigo)
 * 2. ecommerceProducts (upsert by priceListId) with dimensions, packaging, variant info
 * 3. ecommerceProductGroups (auto-create from variant_genericDisplayName)
 * 4. productContent (upsert description)
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseCSVLine(line, separator = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function detectSeparator(firstLine) {
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
}

async function main() {
    const csvPath = path.join(__dirname, '..', 'info-extra', 'Grupos de Producto e Informaciòn - Hoja 1.csv');

    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found at:', csvPath);
        process.exit(1);
    }

    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvText.split('\n').filter(l => l.trim());
    const separator = detectSeparator(lines[0]);
    const headers = parseCSVLine(lines[0], separator);

    console.log(`📋 Headers (${headers.length}):`, headers.join(', '));
    console.log(`📊 Data rows: ${lines.length - 1}`);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], separator);
        if (values.length < headers.length / 2) continue; // skip broken rows
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h.trim()] = (values[idx] || '').trim();
        });
        if (obj.productId) rows.push(obj);
    }

    console.log(`✅ Parsed ${rows.length} valid rows`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Track groups: variant_genericDisplayName -> group id
        const groupMap = new Map();
        // Track group_name categories
        const categoryMap = new Map();

        let created = 0, updated = 0, groupsCreated = 0, contentUpdated = 0;

        for (const row of rows) {
            const productId = row.productId;
            const productName = row.name || productId;
            const description = row.description || null;
            const price = parseFloat(row.pricePerUnit) || 0;
            const unitName = row.packaging_unitName || row.formats_0_displayName || null;
            const groupName = row.group_name || null;
            const variantParentSku = row.variant_parentSku || null;
            const variantGenericName = row.variant_genericDisplayName || null;
            const variantIndex = parseInt(row.variant_index) || 0;
            const color = row.variant_features_0_value || null;
            const minUnit = parseInt(row.constraints_minUnit) || 1;
            const stepSize = parseInt(row.constraints_stepSize) || 1;
            const isDisabled = row.isDisabled === 'TRUE' || row.isDisabled === 'true';

            // Dimensions
            const weight = row.dimensions_weight ? parseFloat(row.dimensions_weight) : null;
            const weightUnit = row.dimensions_weightUnit || null;
            const length = row.dimensions_length ? parseFloat(row.dimensions_length) : null;
            const lengthUnit = row.dimensions_lengthUnit || null;
            const width = row.dimensions_width ? parseFloat(row.dimensions_width) : null;
            const widthUnit = row.dimensions_widthUnit || null;
            const height = row.dimensions_height ? parseFloat(row.dimensions_height) : null;
            const heightUnit = row.dimensions_heightUnit || null;
            const volume = row.dimensions_volume ? parseFloat(row.dimensions_volume) : null;
            const volumeUnit = row.dimensions_volumeUnit || null;

            // Packaging
            const pkgPackageName = row.packaging_packageName || null;
            const pkgPackageUnit = row.packaging_packageUnit || null;
            const pkgAmountPerPackage = row.packaging_amountPerPackage ? parseInt(row.packaging_amountPerPackage) : null;
            const pkgBoxName = row.packaging_boxName || null;
            const pkgBoxUnit = row.packaging_boxUnit || null;
            const pkgAmountPerBox = row.packaging_amountPerBox ? parseInt(row.packaging_amountPerBox) : null;
            const pkgPalletName = row.packaging_palletName || null;
            const pkgPalletUnit = row.packaging_palletUnit || null;
            const pkgAmountPerPallet = row.packaging_amountPerPallet ? parseInt(row.packaging_amountPerPallet) : null;

            // 1. Upsert priceList
            let priceListId;
            const existingPL = await client.query('SELECT id FROM price_list WHERE codigo = $1 LIMIT 1', [productId]);

            if (existingPL.rows.length > 0) {
                priceListId = existingPL.rows[0].id;
                await client.query(
                    `UPDATE price_list SET producto = $1, unidad = $2, lista = $3, canal_digital = $3, updated_at = NOW() WHERE id = $4`,
                    [productName, unitName, price.toString(), priceListId]
                );
            } else {
                const insertPL = await client.query(
                    `INSERT INTO price_list (id, codigo, producto, unidad, lista, canal_digital, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $4, NOW(), NOW()) RETURNING id`,
                    [productId, productName, unitName, price.toString()]
                );
                priceListId = insertPL.rows[0].id;
            }

            // 2. Auto-create ecommerceProductGroups from variant_genericDisplayName
            let groupId = null;
            if (variantGenericName && variantParentSku) {
                const groupKey = variantGenericName;
                if (!groupMap.has(groupKey)) {
                    // Check if already exists in DB
                    const existingGroup = await client.query(
                        `SELECT id FROM ecommerce_product_groups WHERE nombre = $1 LIMIT 1`,
                        [variantGenericName]
                    );
                    if (existingGroup.rows.length > 0) {
                        groupMap.set(groupKey, existingGroup.rows[0].id);
                    } else {
                        const insertGroup = await client.query(
                            `INSERT INTO ecommerce_product_groups (id, nombre, descripcion, categoria, activo, orden, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, true, 0, NOW(), NOW()) RETURNING id`,
                            [variantGenericName, description || null, groupName]
                        );
                        groupMap.set(groupKey, insertGroup.rows[0].id);
                        groupsCreated++;
                        console.log(`  📦 Created group: ${variantGenericName} (${groupName})`);
                    }
                }
                groupId = groupMap.get(groupKey);
            }

            // 3. Upsert ecommerceProducts
            const existingEcom = await client.query(
                `SELECT id FROM ecommerce_products WHERE price_list_id = $1 LIMIT 1`,
                [priceListId]
            );

            const isMainVariant = variantIndex === 0;
            const variantLabel = color || null;

            if (existingEcom.rows.length > 0) {
                await client.query(
                    `UPDATE ecommerce_products SET
            categoria = $1, descripcion = $2, activo = $3, precio_ecommerce = $4,
            variant_parent_sku = $5, variant_generic_display_name = $6, variant_index = $7,
            color = $8, min_unit = $9, step_size = $10, format_unit = $11,
            group_id = $12, variant_label = $13, is_main_variant = $14,
            weight = $15, weight_unit = $16, length = $17, length_unit = $18,
            width = $19, width_unit = $20, height = $21, height_unit = $22,
            volume = $23, volume_unit = $24,
            packaging_package_name = $25, packaging_package_unit = $26, packaging_amount_per_package = $27,
            packaging_box_name = $28, packaging_box_unit = $29, packaging_amount_per_box = $30,
            packaging_pallet_name = $31, packaging_pallet_unit = $32, packaging_amount_per_pallet = $33,
            updated_at = NOW()
          WHERE id = $34`,
                    [
                        groupName, description, !isDisabled, price.toString(),
                        variantParentSku, variantGenericName, variantIndex,
                        color, minUnit, stepSize, unitName,
                        groupId, variantLabel, isMainVariant,
                        weight, weightUnit, length, lengthUnit,
                        width, widthUnit, height, heightUnit,
                        volume, volumeUnit,
                        pkgPackageName, pkgPackageUnit, pkgAmountPerPackage,
                        pkgBoxName, pkgBoxUnit, pkgAmountPerBox,
                        pkgPalletName, pkgPalletUnit, pkgAmountPerPallet,
                        existingEcom.rows[0].id
                    ]
                );
                updated++;
            } else {
                await client.query(
                    `INSERT INTO ecommerce_products (
            id, price_list_id, categoria, descripcion, activo, precio_ecommerce,
            variant_parent_sku, variant_generic_display_name, variant_index,
            color, min_unit, step_size, format_unit,
            group_id, variant_label, is_main_variant,
            weight, weight_unit, length, length_unit,
            width, width_unit, height, height_unit,
            volume, volume_unit,
            packaging_package_name, packaging_package_unit, packaging_amount_per_package,
            packaging_box_name, packaging_box_unit, packaging_amount_per_box,
            packaging_pallet_name, packaging_pallet_unit, packaging_amount_per_pallet,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21, $22, $23,
            $24, $25,
            $26, $27, $28,
            $29, $30, $31,
            $32, $33, $34,
            NOW(), NOW()
          )`,
                    [
                        priceListId, groupName, description, !isDisabled, price.toString(),
                        variantParentSku, variantGenericName, variantIndex,
                        color, minUnit, stepSize, unitName,
                        groupId, variantLabel, isMainVariant,
                        weight, weightUnit, length, lengthUnit,
                        width, widthUnit, height, heightUnit,
                        volume, volumeUnit,
                        pkgPackageName, pkgPackageUnit, pkgAmountPerPackage,
                        pkgBoxName, pkgBoxUnit, pkgAmountPerBox,
                        pkgPalletName, pkgPalletUnit, pkgAmountPerPallet,
                    ]
                );
                created++;
            }

            // 4. Upsert productContent
            if (description) {
                const existingContent = await client.query(
                    'SELECT id FROM product_content WHERE codigo = $1 LIMIT 1',
                    [productId]
                );
                if (existingContent.rows.length > 0) {
                    await client.query(
                        'UPDATE product_content SET descripcion = $1, updated_at = NOW() WHERE codigo = $2',
                        [description, productId]
                    );
                } else {
                    await client.query(
                        `INSERT INTO product_content (id, codigo, descripcion, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())`,
                        [productId, description]
                    );
                }
                contentUpdated++;
            }
        }

        await client.query('COMMIT');

        console.log('\n========== IMPORT SUMMARY ==========');
        console.log(`📦 Products created: ${created}`);
        console.log(`🔄 Products updated: ${updated}`);
        console.log(`📂 Groups created: ${groupsCreated}`);
        console.log(`📝 Content entries: ${contentUpdated}`);
        console.log('====================================');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error during import:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);
