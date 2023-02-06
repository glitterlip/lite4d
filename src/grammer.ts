import Builder, { BindingTypes, Expression, Having, Order, Where } from "./builder";
import pre from "@changesets/cli/dist/declarations/src/commands/pre";

const SelectComponents = [
	"aggregate",
	"columns",
	"from",
	"joins",
	"wheres",
	"groups",
	"havings",
	"orders",
	"limit",
	"offset",
	"lock"
];

export class Grammer {
	tablePrefix: string = "";

	constructor() {
	}

	setTablePrefix(prefix: string) {
		this.tablePrefix = prefix;
	}

	wrap(value: string | Expression): string {
		if (Builder.isExpression(value)) {
			return (<Expression>value).getValue();
		}

		if ((value as string).indexOf(" as ") > -1) {
			return this.wrapAliasedValue((value as string));
		}

		return this.wrapSegments((value as string).split("."));
	}

	wrapAliasedValue(value: string, prefix: boolean = false): string {
		let segments = value.split(" as ");
		if (prefix) {
			segments[1] = this.tablePrefix + segments[1];
		}
		return `${this.wrap(segments[0])} as ${this.wrapValue(segments[1])}`;
	}

	wrapTable(table: string | Expression): string {
		if (table instanceof Expression) {
			return table.getValue();
		}
		return this.wrap(table);
	}

	wrapSegments(segments: string[]): string {
		return segments.map((v, k) => {
			return k == 0 && segments.length > 1 ? this.wrapTable(v) : this.wrapValue(v);
		}).join(".");

	}


	wrapValue(value: string): string {
		return value !== "*" ? `"${value.replace("\"", "\"\"")}"` : value;
	}

	columnize(columns: string[]): string {
		if (!columns.length) {
			return "*";
		}
		return columns.map((c) => {
			return this.wrap(c);
		}).join(", ");
	}

	parameter(param: Expression | any): string {

		return Builder.isExpression(param) ? param.getValue() : "?";

	}

	parameterize(params: any[]): string {
		return params.map(p => {
			return this.parameter(p);
		}).join(", ");
	}


	compileSelect(builder: Builder): string {

		let segments: string[] = [];
		if (!builder._columns) {
			builder._columns = ["*"];
		}

		for (let selecElement of SelectComponents) {
			let property = "_" + selecElement;
			let method = "compile" + selecElement[0].toUpperCase() + selecElement.slice(1);
			// @ts-ignore
			builder[property] && segments.push(builder.grammer[method](builder, builder[property]));
		}
		return segments.filter(v => {
			return !!v;
		}).join(" ");
	}

	compileAggregate(builder: Builder, aggregate: { func: string, column: string }): string {
		let column = aggregate.column;
		if (builder._distinct) {
			column = "distinct " + column;
		}
		return `select ${aggregate["func"]}(${column}) as aggregate`;

	}

	compileColumns(builder: Builder, columns: string[]): string {
		if (builder._aggregate) {
			return "";
		}

		return `select ${builder._distinct ? "distinct " : ""}${this.columnize(columns)}`;
	}

	compileFrom(builder: Builder, table: string): string {
		return `from ${this.wrapTable(table)}`;
	}

	// compileJoins(): string {
	// }
	compileWhereRaw(builder: Builder, where: Where): string {
		return where.rawSql as string;
	}

	compileWheres(builder: Builder, wheres: Where[]): string {
		if (!wheres || !wheres.length) {
			return "";
		}

		let whereStr = wheres.map((w, k) => {
			let method = `compileWhere${w["type"][0].toUpperCase()}${w["type"].slice(1)}`;
			let where = "";
			//basic=>compileWhereBasic
			// if (Object.prototype.hasOwnProperty.call(this, method)) {
			// @ts-ignore
			where = this[method](builder, w);
			// }
			return `${w["bool"]} ${where}`;
		}).join(" ").replace(/(and )|(or )/, "");


		return `where ${whereStr}`;

	}

	compileWhereBasic(builder: Builder, where: Where): string {
		return `${this.wrap(<string>where.column)} ${where.operator} ${this.parameter(where.value)}`;
	}

	compileWhereBetween(builder: Builder, where: Where): string {
		let values = <any[]>where.values;
		return `${this.wrap(<string>where.column)} ${where.not ? "not between" : "between"} ${this.parameter(values[0])} and ${this.parameter(values[1])}`;
	}

	compileWhereBetweenColumns(builder: Builder, where: Where): string {
		let values = <any[]>where.values;
		return `${this.wrap(<string>where.column)} ${where.not ? "not between" : "between"} ${this.wrap(values[0])} and ${this.wrap(values[1])}`;
	}

	compileWhereColumn(builder: Builder, where: Where): string {
		return `${this.wrap(<string>where.first)} ${where.operator} ${this.wrap(<string>where.second)}`;
	}

	compileWhereNested(builder: Builder, where: Where): string {
		return `(${this.compileWheres(builder, where.query?._wheres as Where[]).slice(6)})`;
	}

	compileWhereSub(builder: Builder, where: Where): string {
		return `${this.wrap(where.column as string)} ${where.operator} (${this.compileSelect(where.query as Builder)})`;
	}

	compileWhereExists(builder: Builder, where: Where): string {
		return `exists (${this.compileSelect(where.query as Builder)})`;
	}

	compileWhereNotExists(builder: Builder, where: Where): string {
		return `not ${this.compileWhereExists(builder, where)}`;
	}

	// compileWhereRowValues(where: Where): string {
	//
	// }

	compileWhereNotIn(builder: Builder, where: Where): string {
		return this.compileWhereIn(builder, where, true);
	}

	compileWhereIn(builder: Builder, where: Where, not: boolean = false): string {
		if (where.values) {
			let t = `${this.wrap(where.column as string)} ${not ? "not " : ""}in (${this.parameterize(where.values)})`;
			return t;
		}
		return "0=1";
	}

	compileWhereNull(builder: Builder, where: Where, not: boolean = false): string {
		return `${this.wrap(where.column as string)} is ${not ? "not " : ""}null`;
	}

	compileWhereNotNull(builder: Builder, where: Where): string {
		return this.compileWhereNull(builder, where, true);
	}


	compileGroups(builder: Builder, groups: string[]): string {
		if (!groups || !groups.length) {
			return "";
		}
		return `group by ${this.columnize(groups)}`;

	}

	compileHaving(builder: Builder, having: Having): string {
		switch (having.type) {
			case "basic":
				return `${this.wrap(having.column as string)} ${having.operator} ${this.parameter(having.value)}`;
			case "raw":
				return having.rawSql as string;
			case "null":
				return `${this.wrap(having.column as string)} is null`;
			case "notNull":
				return `${this.wrap(having.column as string)} is not null`;
			case "nested":
				let havings = (having.query as Builder)._havings as Having[];

				return `(${this.compileHavings(builder, havings).slice(7)})`;
			case "between":
				let values = having.values as any[];
				return `${having.column} ${having.not ? "not between" : "between"} ${this.parameter(values[0])} and ${this.parameter(values[1])}`;
		}
		return "";
	}

	compileHavings(builder: Builder, havings: Having[]): string {
		if (!havings || !havings.length) {
			return "";
		}
		let havingStr = havings.map((h, k) => {
			return `${k > 0 ? h.bool + " " : ""}${this.compileHaving(builder, h)}`;
		}).join(" ");
		return `having ${havingStr}`;
	}

	compileOrders(builder: Builder, orders: Order[]): string {
		if (!orders || !orders.length) {
			return "";
		}
		let orderStr = orders.map((o: Order) => {
			if (Builder.isExpression(o.column)) {
				return (o.column as Expression).getValue();
			}
			return o.rawSql ? o.rawSql : `"${o.column}" ${o.direction}`;
		}).join(", ");
		return `order by ${orderStr}`;
	}

	compileLimit(builder: Builder, limit: number): string {
		return `limit ${limit}`;
	}

	compileOffset(builder: Builder, offset: number): string {
		return `offset ${offset}`;
	}

	compileInsert(query: Builder, values: Array<object | Map<string, any>>): string {

		let keys = this.prepareKeys(values);
		let items = this.prepareValues(keys, values);
		let parameters = items.map(i => {
			return `(${this.parameterize(i)})`;
		}).join(", ");

		return `insert into ${this.wrapTable(query._from)} (${this.columnize(keys)}) values ${parameters}`;
	}

	prepareKeys(values: Array<object | Map<string, any>>): string[] {
		let first = values[0];
		if (first instanceof Map) {
			return [...first.keys()];
		} else {
			return Object.keys(first);
		}
	}

	prepareValues(keys: string[], values: Array<object | Map<string, any>>): any[][] {
		let result: any[] = [];
		values.forEach(v => {
			let o: any[] = [];
			if (v instanceof Map) {
				keys.forEach(k => {
					o.push(v.get(k));
				});
			} else {
				keys.forEach(k => {
					// @ts-ignore
					v.hasOwnProperty(k) && o.push(v[k]);
				});
			}
			result.push(o);
		});


		return result;
	}

	// compileLock(): string {
	// }
	compileUpdate(builder: Builder, values: Map<string, any> | object) {

		let columns: string;

		if (values instanceof Map) {
			columns = [...values.keys()].map(k => {
				return `${this.wrap(k)} = ${this.parameter(values.get(k))}`;
			}).join(", ");
		} else {
			columns = Object.keys(values).map(k => {
				// @ts-ignore
				return `${this.wrap(k)} = ${this.parameter(values[k])}`;
			}).join(", ");
		}
		return `update ${this.wrapTable(builder._from)} set ${columns} ${this.compileWheres(builder,builder._wheres)}`;
	}

	compileDelete(builder: Builder) {
		return `delete from ${this.wrapTable(builder._from)} ${this.compileWheres(builder,builder._wheres)}`;
	}


}
