import sqlts from '@rmp135/sql-ts';

const dbFilePath:string = `${__dirname}/../../app/db.ts`;

const config = {
	'dialect':'sqlite3',
	'connection': {
		'filename': './db-buildTypes.sqlite',
	},
	'useNullAsDefault': true,
	'excludedTables': ['knex_migrations', 'knex_migrations_lock', 'android_metadata'],
	'interfaceNameFormat': 'PascalCaseSingular',
	'filename': './app/db',
	'fileReplaceWithinMarker': '// AUTO-GENERATED-TYPES',
	'extends': {
		'main.sessions': 'WithDates, WithUuid',
		'main.users': 'WithDates, WithUuid',
		'main.permissions': 'WithDates, WithUuid',
		'main.files': 'WithDates, WithUuid',
	},
};

function insertContentIntoFile(filePath:string, markerOpen:string, markerClose:string, contentToInsert:string):void {
	const fs = require('fs');
	if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
	let content:string = fs.readFileSync(filePath, 'utf-8');
	// [^]* matches any character including new lines
	const regex:RegExp = new RegExp(`${markerOpen}[^]*?${markerClose}`);
	if (!content.match(regex)) throw new Error(`Could not find markers: ${markerOpen}`);
	content = content.replace(regex, `${markerOpen}\n${contentToInsert}\n${markerClose}`);
	fs.writeFileSync(filePath, content);
}

// To output:
//
// export interface User extends WithDates, WithUuid {
// 	email?: string
// 	password?: string
// 	is_admin?: number
// }
function createTypeString(table:any) {
	const colStrings = [];
	for (const col of table.columns) {
		let name = col.propertyName;
		let type = col.propertyType;

		if (table.extends.indexOf('WithDates') >= 0) {
			if (['created_time', 'updated_time'].includes(name)) continue;
		}

		if (table.extends.indexOf('WithUuid') >= 0) {
			if (['id'].includes(name)) continue;
		}

		if (name === 'item_type') type = 'ItemType';

		colStrings.push(`\t${name}?: ${type}`);
	}

	const header = ['export interface'];
	header.push(table.interfaceName);
	if (table.extends) header.push(`extends ${table.extends}`);

	return `${header.join(' ')} {\n${colStrings.join('\n')}\n}`;
}

// To output:
//
// export const databaseSchema:DatabaseTables = {
// 	users: {
// 		id: { type: "string" },
// 		email: { type: "string" },
// 		password: { type: "string" },
// 		is_admin: { type: "number" },
// 		updated_time: { type: "number" },
// 		created_time: { type: "number" },
// 	},
// }
function createRuntimeObject(table:any) {
	const colStrings = [];
	for (const col of table.columns) {
		let name = col.propertyName;
		let type = col.propertyType;
		colStrings.push(`\t\t${name}: { type: "${type}" },`);
	}

	return `\t${table.name}: {\n${colStrings.join('\n')}\n\t},`;
}

async function main() {
	const definitions = await sqlts.toObject(config);

	const typeStrings = [];
	for (const table of definitions.tables) {
		typeStrings.push(createTypeString(table));
	}

	const tableStrings = [];
	for (const table of definitions.tables) {
		tableStrings.push(createRuntimeObject(table));
	}

	let content = `// Auto-generated using \`npm run generate-types\`\n${typeStrings.join('\n\n')}`;
	content += '\n\n';
	content += `export const databaseSchema:DatabaseTables = {\n${tableStrings.join('\n')}\n}`;

	insertContentIntoFile(dbFilePath, config.fileReplaceWithinMarker, config.fileReplaceWithinMarker, content);
}

main().catch(error => {
	console.error('Fatal error', error);
	process.exit(1);
});
