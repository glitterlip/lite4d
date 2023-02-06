import database, { Connection } from "./database";
import { Grammer } from "./grammer";
import { Paginator } from "./paginator";

export type BindingTypes =
	"select"
	| "from"
	| "join"
	| "where"
	| "groupBy"
	| "having"
	| "order"
	| "union"
	| "unionOrder";
const WhereTypes = [
	"basic",
	"column",
	"raw",
	"in",
	"notIn",
	"null",
	"notNull",
	"exists",
	"notEists",
	"between",
	"betweenColumns",
	"nested",
	"sub",
	"unionOrder"
] as const;
type BuilderCallback = (builder: Builder) => Builder
type Queryable = Builder | BuilderCallback | Expression
type QueryableOrStr = Queryable | string


export interface Where {
	type: typeof WhereTypes[number];
	column?: string;
	bool: string;
	rawSql?: string;
	not?: boolean;
	operator?: typeof Operators[number]
	values?: any[];
	value?: any;
	query?: Builder;
	first?: any;
	second?: any;
}

export interface Having {
	type: typeof WhereTypes[number],
	column?: string,
	operator?: string,
	value?: string,
	bool: string,
	rawSql?: string,
	not?: boolean,
	values?: any[];
	query?: Builder

}

export interface Order {
	column?: string | Expression,
	direction?: "asc" | "desc",
	rawSql?: string
}

export class Expression {
	value: any;

	constructor(value: any) {
		this.value = value;
	}

	getValue(): string {
		return this.value.toString();
	}
}

const Operators = [
	"=", "<", ">", "<=", ">=", "<>", "!=", "<=>",
	"like", "like binary", "not like", "ilike",
	"&", "|", "^", "<<", ">>", "&~", "is", "is not",
	"rlike", "not rlike", "regexp", "not regexp",
	"~", "~*", "!~", "!~*", "similar to",
	"not similar to", "not ilike", "~~*", "!~~*"
] as const;
const BitwiseOperators = [
	"&", "|", "^", "<<", ">>", "&~"
];
export default class Builder {
	// @ts-ignore
	connection: Connection;

	_bindings: { [key in BindingTypes]: any[] };
	_aggregate: { func: string, column: string } | null;
	_columns: Array<QueryableOrStr>;
	_distinct: boolean;
	_from: string;
	//  _joins
	_wheres: Where[];
	_groups: Array<string | Expression>;
	_havings: Array<Having>;
	_orders: Array<Order>;
	_limit: number;
	_offset: number;
	grammer: Grammer;
	// _unions
	// _unionLimit
	// _unionOffset
	// _unionOrders


	constructor() {
		this._bindings = {
			"select": [],
			"from": [],
			"join": [],
			"where": [],
			"groupBy": [],
			"having": [],
			"order": [],
			"union": [],
			"unionOrder": []
		};
		this._columns = [];
		this._wheres = [];
		this._groups = [];
		this._havings = [];
		this._orders = [];
		this._from = "";
		this._distinct = false;
		this.grammer = new Grammer();
		this._aggregate = null;
		this._offset = this._limit = 0;


	}

	setConnection(connection: Connection): Builder {
		this.connection = connection;
		return this;
	}

	static isQuerable(query: any): boolean {
		return query instanceof Builder || query instanceof Function;
	}

	static isExpression(v: any): boolean {
		return (typeof v === "object") && (v.constructor.name === "Expression");
	}

	addBinding(value: any, bindingtype: BindingTypes = "where"): Builder {

		if (Array.isArray(value)) {
			value = value.filter(v => {
				// return v instanceof Expression not working
				return (typeof v !== "object") || (v.constructor.name !== "Expression");
			});

			if (value.length) {
				this._bindings[bindingtype] = this._bindings[bindingtype].concat(value);
			}

		} else {

			this._bindings[bindingtype].push(value);
		}
		return this;
	}

	/**
	 * set columns to be selected
	 * @param columns
	 */
	select(columns: QueryableOrStr | QueryableOrStr[] = "*"): Builder {
		this._columns = [];
		this._bindings["select"] = [];
		if (!Array.isArray(columns)) {
			this._columns = [columns];
		} else {
			this._columns = columns;
		}

		return this;
	}

	selectSub(query: QueryableOrStr, as: string = ""): Builder {
		const { query: q, bindings } = this.createSub(query);
		return this.selectRaw(`(${q}) as ${this.grammer.wrap(as)}`, bindings);
	}

	selectRaw(expression: string, bindings: any[]): Builder {

		this.addSelect(new Expression(expression));
		if (bindings) {
			this.addBinding(bindings, "select");
		}
		return this;
	}

	fromSub(query: QueryableOrStr, as: string = ""): Builder {
		const { query: q, bindings } = this.createSub(query);
		return this.fromRaw(`(${q}) as ${this.grammer.wrapTable(as)}`, bindings);
	}

	fromRaw(expression: string, bindings: any[]): Builder {
		this._from = new Expression(expression).getValue();
		this.addBinding(bindings, "from");
		return this;
	}

	createSub(query: QueryableOrStr): { query: string | Expression, bindings: any[] } {
		if (query instanceof Function) {
			query = query(this.forSubQuery());
		}

		return this.parseSub(query);
	}

	parseSub(query: string | Builder | Expression): { query: string | Expression, bindings: any[] } {

		if (query instanceof Builder) {
			return { query: query.toSql(), bindings: query.getBindings() };
		}
		return { query, bindings: [] };
	}

	addSelect(column: string | Expression | string[]): Builder {
		if (Array.isArray(column)) {
			this._columns.concat(column);
		} else {
			this._columns.push(column);
		}
		return this;
	}

	distinct(): Builder {
		this._distinct = true;
		return this;
	}

	from(table: QueryableOrStr, as: string = ""): Builder {
		if (typeof table === "string") {
			this._from = as ? `${table} as ${as}` : table;
			return this;
		} else {
			return this.fromSub(table, as);
		}
	}

	/**
	 * inner join
	 */
	join() {

	}

	joinWhere() {

	}

	joinSub() {

	}

	leftOuterJoin() {
	}

	leftOuterJoinWhere() {
	}

	leftOuterJoinSub() {
	}

	newJoinClause() {

	}

	/**
	 * builder.where('age',7)
	 * builder.where('age','>',7)
	 * builder.where('name','=','Jimmy','or')
	 * builder.where({name:'Jim',age:7})
	 * builder.where(new Builder().where('age',18))
	 * builder.where((b):Builder=>{
	 *   return b.where('age',18)
	 * })
	 * builder.where([['gender','male'],['age','>',18],{name:'Jim',age:7}])
	 * @param column
	 * @param operator
	 * @param value
	 * @param bool
	 */
	where(column: any, operator: any = null, value: any = null, bool: string = "and"): Builder {

		if (Array.isArray(column)) {
			return this.addArrayOfWheres(column, bool);
		}
		if (typeof column === "object" && !(column instanceof Expression)) {
			for (let index in column) {
				this.where(index, column[index], bool);
			}
			return this;
		}
		if (arguments.length === 2) {
			value = operator;
			operator = "=";
		}

		if (column instanceof Function && operator === null) {
			return this.whereNested(column, bool);
		}
		if ((column instanceof Function || column instanceof Builder) && operator !== null) {
			const { query, bindings } = this.createSub(column);

			return this.addBinding(bindings).where(new Expression(`(${query})`), operator, value, bool);

		}

		if (Builder.invalidOperator(operator)) {
			value = operator;
			operator = "=";
		}
		if (value instanceof Function) {
			return this.whereSub(column, operator, value, bool);
		}
		if (value === null) {
			return this.whereNull(column, bool, operator !== "=");
		}
		this._wheres.push({ type: "basic", column, operator, bool, value });
		if (!(value instanceof Expression)) {
			this.addBinding(value);
		}


		return this;
	}

	getWhereFromArray(...args: any[]): { column: string, operator: typeof Operators[number], value: any, bool: string } {

		switch (args.length) {
			case 2:
				return { column: args[0], operator: "=", value: args[1], bool: "and" };
			case 3:
				return { column: args[0], operator: args[1], value: args[2], bool: "and" };
			case 4:
				return { column: args[0], operator: args[1], value: args[2], bool: args[3] };
			default:
				throw new Error(`wrong arguements length expected:2,3,4 got ${args.length}`);

		}
	}


	addArrayOfWheres(column: any[], bool: string = "and"): Builder {

		return this.whereNested((builder: Builder): Builder => {
			column.forEach((v) => {
				if (Array.isArray(v)) {
					let { column, value, operator, bool } = this.getWhereFromArray(...v);
					builder.where(column, operator, value, bool);
				} else if (typeof v === "object") {
					builder.where(v, bool);
				}
			});
			return builder;
		});
	}

	static invalidOperator(operator: any): boolean {
		// @ts-ignore
		return typeof operator !== "string" || !Operators.includes(operator);
	}

	prepareValueAndOperator(value: any, operator: any, defaultOperator: boolean = false): { value: any, operator: typeof Operators[number] } {

		if (defaultOperator) {
			return { value: operator, operator: "=" };
		}
		return { value, operator };
	}

	orWhere(column: any, operator: any = null, value: any = null): Builder {
		if (arguments.length === 2) {
			value = operator;
			operator = "=";
		}
		return this.where(column, operator, value, "or");

	}

	whereNot(column: any, operator: any = null, value: any = null, bool: string = "and"): Builder {
		return this.where(column, operator, value, bool + " not");
	}

	orWhereNot(column: any, operator: any = null, value: any = null) {

		return this.whereNot(column, operator, value, "or");
	}

	whereColumn(first: any, operator: any = null, second: any = null, bool: any = "and"): Builder {
		// if (Array.isArray(first)) {
		// 	return this.addArrayOfWheres(first, bool);
		// }
		if (Builder.invalidOperator(operator)) {
			second = operator;
			operator = "=";
		}

		this._wheres.push({ type: "column", first, operator, second, bool });
		return this;
	}

	orWhereColumn(first: any, operator: any = null, second: any = null, bool: any = "and"): Builder {
		return this.whereColumn(first, operator, second, "or");
	}

	whereRaw(sql: string, bindings: any[] = [], bool: string = "and"): Builder {
		this._wheres.push({ type: "raw", rawSql: sql, bool });
		this.addBinding(bindings);

		return this;
	}

	// orWhereRaw() {
	// }

	whereIn(column: any, values: any = [], bool: string = "and", not: boolean = false): Builder {
		if (Builder.isQuerable(values)) {
			let { query, bindings } = this.createSub(values);
			values = [new Expression(query)];
			this.addBinding(bindings);
		}
		this._wheres.push({ type: not ? "notIn" : "in", column, values, bool });
		this.addBinding(values);
		return this;
	}

	orWhereIn(column: any, values: any = [], bool: string = "or"): Builder {
		return this.whereIn(column, values, bool, false);
	}

	whereNotIn(column: any, values: any = [], bool: string = "and", not: boolean = false): Builder {
		return this.whereIn(column, values, bool, true);
	}

	orWhereNotIn(column: any, values: any = []): Builder {
		return this.whereNotIn(column, values, "or");
	}

	whereNull(column: string | string[], bool: string = "and", not: boolean = false): Builder {

		if (!Array.isArray(column)) {
			column = [column];
		}
		column.forEach(c => {
			this._wheres.push({ type: not ? "notNull" : "null", column: c, bool });
		});
		return this;
	}

	orWhereNull(column: string | string[]): Builder {
		return this.whereNull(column, "or");
	}

	whereNotNull(column: string | string[], bool: string = "and"): Builder {
		return this.whereNull(column, bool, true);
	}

	orWhereNotNull(column: string | string[]): Builder {
		return this.whereNotNull(column, "or");
	}

	whereBetween(column: any, values: any[] = [], bool: string = "and", not: boolean = false): Builder {
		this._wheres.push({ type: "between", column, values, bool, not });
		this.addBinding(values.slice(0, 2));
		return this;
	}

	whereBetweenColumns(column: string, values: any[], bool: string = "and", not: boolean = false): Builder {
		this._wheres.push({ type: "betweenColumns", bool, not, column, values });
		return this;
	}

	// orWhereBetween() {
	// }

	// whereNotBetween() {
	// }

	// orWhereNotBetween() {
	// }
	// whereDate():Builder{}
	// whereTime():Builder{}
	// whereYear():Builder{}
	// whereMonth():Builder{}
	// whereDay():Builder{}
	// addDateBasedWhere():Builder{}

	whereNested(callback: BuilderCallback, bool: string = "and"): Builder {

		return this.addNestedWhereQuery(callback(this.forNestedWhere()), bool);
	}

	forNestedWhere(): Builder {
		return this.newQuery().from(<string>this._from);
	}

	addNestedWhereQuery(query: Builder, bool: string = "and"): Builder {
		if (query._wheres) {
			this._wheres.push({ type: "nested", query, bool });
			this.addBinding(query.getRawBindings()["where"], "where");
		}
		return this;
	}

	whereSub(column: string, operator: typeof Operators[number], callback: Function, bool: string): Builder {
		let query = callback(this.forSubQuery());
		this._wheres.push({ type: "sub", column, operator, query, bool });
		this.addBinding(query.getBindings());
		return this;
	}

	// whereExists() {
	//
	// }

	// addWhereExistsQuery(): Builder {
	//
	// }

	// orWhereExists() {
	// }

	// whereNotExists() {
	// }

	// orWhereNotExists() {
	// }

	// whereRowValues() {
	// }

	// orWhereRowValues() {
	// }


	groupBy(groups: string | Expression | Array<string> | Array<Expression>): Builder {
		let arr: Array<string | Expression>;
		if (!Array.isArray(groups)) {
			arr = [groups];
		} else {
			arr = groups;
		}
		arr.forEach((g: string | Expression) => {
			this._groups.push(g);
		});
		return this;
	}

	groupByRaw(sql: string, bindings: [] = []): Builder {
		this._groups.push(new Expression(sql));
		this.addBinding(bindings, "groupBy");
		return this;
	}

	having(column: any, operator: any = null, value: any = null, bool: string = "and"): Builder {
		let converted = this.prepareValueAndOperator(value, operator, arguments.length == 2);
		value = converted.value;
		operator = converted.operator;

		if (typeof column === "function" && operator === null) {
			return this.havingNested(column, bool);
		}
		if (Builder.invalidOperator(operator)) {
			value = operator;
			operator = "=";
		}
		this._havings.push({ type: "basic", value, operator, bool, column, not: false });
		if (!(value instanceof Expression)) {
			this.addBinding(value, "having");
		}
		return this;

	}

	orHaving(column: any, operator: any = null, value: any = null): Builder {
		return this.having(column, operator, value, "or");
	}

	havingRaw(rawSql: string, bindings: any[] = [], bool: string = "and"): Builder {
		this._havings.push({ type: "raw", rawSql, bool });
		this.addBinding(bindings, "having");
		return this;
	}

	havingNested(column: BuilderCallback, bool: string = "and"): Builder {
		let q = this.forNestedWhere();
		column(q);
		if (q._havings && q._havings.length) {
			this.addBinding(q.getRawBindings()["having"], "having");
			this._havings.push({ type: "nested", query: q, bool });
		}
		return this;
	}

	orderBy(column: any, direction: "asc" | "desc" = "asc"): Builder {
		if (Builder.isQuerable(column)) {
			let { query, bindings } = this.createSub(column);
			column = new Expression(`(${query})`);
			this.addBinding(bindings, "order");
		}
		this._orders.push({ column, direction });

		return this;

	}

	orderByRaw(rawSql: string, bindings: any[]): Builder {
		this._orders.push({ rawSql });
		this.addBinding(bindings, "order");
		return this;
	}

	skip(value: number): Builder {

		return this.offset(value);
	}

	offset(value: number): Builder {
		this._offset = Math.max(0, value);
		return this;

	}

	take(value: number): Builder {

		return this.limit(value);
	}

	limit(value: number): Builder {
		if (value) {

			this._limit = value;
		}
		return this;
	}


	forPage(page: number, perPage: number = 15): Builder {
		return this.offset((page - 1) * perPage).limit(perPage);
	}

	toSql(): string {

		return this.grammer.compileSelect(this);
	}

	find<T>(id: number | string, columns: string[] = ["*"]): Promise<T | null> {
		return this.where("id", id).first<T>(columns);
	}

	first<T>(columns: string[] | null = null): Promise<T | null> {
		if (columns) {
			this.select(columns);
		}
		return this.connection.First(this.toSql(), this.getBindings());
	}

	value<T>(column: string): Promise<T | null> {
		this.select(column);
		return this.connection.First<T>(this.toSql(), this.getBindings(), column);
	}

	get<T>(columns: string[] | null = null): Promise<D1Result<T>> {
		if (columns) {
			this.select(columns);
		}
		return this.runSelect<T>();
	}

	runSelect<T>(): Promise<D1Result<T>> {
		return this.connection.Select(this.toSql(), this.getBindings());
	}


	count<T>(column: string = "*"): Promise<T> {
		return this.aggregate<T>("count", column);
	}

	min<T>(column: string): Promise<T> {
		return this.aggregate<T>("min", column);
	}

	max<T>(column: string): Promise<T> {
		return this.aggregate<T>("max", column);
	}

	avg<T>(column: string): Promise<T> {
		return this.aggregate<T>("avg", column);
	}

	sum<T>(column: string): Promise<T> {
		return this.aggregate<T>("sum", column);
	}

	aggregate<T>(func: string, column: string = "*"): Promise<T> {
		this._aggregate = { func, column };
		return this.connection.First(this.toSql(), this.getBindings(), "aggregate") as Promise<T>;
	}

	insert(values: any): Promise<D1Result> {
		if (!Array.isArray(values)) {
			values = [values];
		}

		let vs: any[] = [];
		values.forEach((v: object | Map<string, any>) => {
			if (v instanceof Map) {
				[...v.keys()].forEach(k => {
					vs.push(v.get(k));
				});
			} else {
				[...Object.keys(v)].forEach((k) => {
					// @ts-ignore
					vs.push(v[k]);
				});
			}
		});

		return this.connection.Insert(this.grammer.compileInsert(this, values), vs);

	}

	update(values: object | Map<string, any>): Promise<D1Result> {

		let old = this._bindings["join"];
		this._bindings["select"] = [];
		this._bindings["join"] = [];

		let vs: any[];
		if (values instanceof Map) {
			vs = [...values.keys()].map(k => {
				return values.get(k);

			});
		} else {
			vs = [...Object.keys(values)].map((k) => {
				// @ts-ignore
				return values[k];
			});
		}
		return this.connection.Update(this.grammer.compileUpdate(this, values), old.concat(vs.filter(v => {
			return !Builder.isExpression(v);
		})).concat(this.getBindings()));
	}

	delete(id: any = null): Promise<D1Result> {
		if (id) {
			this.where(this._from + ".id", id);
		}
		this._bindings["select"] = [];


		return this.connection.Delete(this.grammer.compileDelete(this), this.getBindings());

	}

	newQuery(): Builder {
		return new Builder().setConnection(this.connection);
	}

	forSubQuery(): Builder {
		return this.newQuery();
	}

	async paginate<T>(page: number, perPage: number = 15, columns: Array<string> = ["*"]): Promise<Paginator<T>> {

		if (this._groups.length || this._havings.length) {
			throw Error("not supported yet");
		}

		let q: Builder = this.clone();
		q._columns = [];
		q._orders = [];
		q._limit = 0;
		q._offset = 0;
		q._bindings["select"] = [];
		q._bindings["order"] = [];
		let count = await q.count() as number;

		let items = count ? (await this.forPage(page, perPage).get<T>(columns))["results"] as Array<T> : [];

		return new Paginator<T>(items, count, perPage, page);
	}

	clone(): Builder {
		let newQuery = this.newQuery()
		newQuery._bindings = this._bindings
		newQuery._columns = this._columns;
		newQuery._wheres = this._wheres
		newQuery._groups = this._groups
		newQuery._havings = this._havings
		newQuery._orders = this._orders
		newQuery._from = this._from
		newQuery._distinct = this._distinct
		newQuery.grammer = new Grammer()
		newQuery._aggregate = this._aggregate
		newQuery._offset = this._offset
		newQuery._limit = this._limit
		return newQuery
	}


	//TODO:
	// raw() {
	//
	// }

	getBindings(): any[] {
		let bindings: any[] = [];
		Object.keys(this._bindings).forEach((k) => {
			if (this._bindings[<BindingTypes>k] && this._bindings[<BindingTypes>k].length) {

				bindings = bindings.concat(this._bindings[<BindingTypes>k]);
			}

		});
		return bindings;
	}

	getRawBindings(): { [key in BindingTypes]: any[] } {
		return this._bindings;
	}

}



