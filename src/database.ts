import Builder from "./builder";

const NORESULT_MSGS = [
	"D1_NORESULTS",
	"Cannot read properties of undefined (reading 'length')"
];

export class Lite4D {
	// @ts-ignore
	db: D1Database;

	connection(connection: D1Database): Lite4D {
		this.db = connection;
		return this;
	}

	table(tablename: string, as: string = ""): Builder {
		return new Builder().setConnection(new Connection(this.db)).from(tablename, as);
	};

	query(): Builder {
		return new Builder().setConnection(new Connection(this.db));
	};

}

export class Connection {
	db: D1Database;

	constructor(d1: D1Database) {
		this.db = d1;
	}

	async First<T>(query: string, bindings: any[], column: string | null = null): Promise<T | null> {
		try {
			if (column === null) {
				return await this.db.prepare(query).bind(...bindings).first<T>();
			} else {
				return await this.db.prepare(query).bind(...bindings).first(column);
			}
		} catch (e: any) {

			if (NORESULT_MSGS.includes(e.message)) {
				return null;
			}
			throw e;
		}

	}

	async Select<T>(query: string, bindings: any[]): Promise<D1Result<T>> {

		return await this.db.prepare(query).bind(...bindings).all<T>();
	}

	async Delete(query: string, bindings: any[]): Promise<D1Result> {
		return await this.db.prepare(query).bind(...bindings).run();

	}

	async Update(query: string, bindings: any[]): Promise<D1Result> {
		return await this.db.prepare(query).bind(...bindings).run();
	}

	async Insert(query: string, bindings: any[]): Promise<D1Result> {
		return await this.db.prepare(query).bind(...bindings).run();

	}

	async Raw<T>(query: string, bindings: any[]): Promise<T[]> {
		return await this.db.prepare(query).bind(...bindings).raw<T>();
	}
}

export default Lite4D;
