import "mocha";
import { expect, assert } from "chai";
import Lite4D from "../src/database";
import Builder, { Expression } from "../lib/builder";
import * as Sinon from "sinon";

const db = new Lite4D();
describe("builder", () => {
	describe("select", () => {
		it("basic select", () => {
			let sql = db.query().select("*").from("users").toSql();
			assert(sql === `select * from "users"`);
		});
		it("quote", function() {
			let sql = db.query().select("*").from(`quote"table`).toSql();
			assert(sql === `select * from "quote""table"`);
		});
		it("table alias", function() {
			let sql = db.query().select("a.b as c.d").from("users").toSql();
			assert(sql === `select "a"."b" as "c.d" from "users"`);
		});
		it("should addselect", function() {
			let sql = db.query().select("name").addSelect("age").from("users").toSql();
			assert(sql === `select "name", "age" from "users"`);
		});
		it("should distinct", function() {
			let sql = db.query().select("a.b as c.d").distinct().from("users").toSql();
			assert(sql === `select distinct "a"."b" as "c.d" from "users"`);
		});
		it("should basic alias", function() {
			let sql = db.query().select("a as b").from("users").toSql();
			assert(sql === `select "a" as "b" from "users"`);
		});
		it("should wrap table", function() {
			let sql = db.query().select().from("users.u").toSql();
			assert(sql === `select * from "users"."u"`);
		});
		it("should selectRaw", function() {
			let sql = db.query().select(new Expression("substr(foo,6)")).from("users.u").toSql();
			assert(sql === `select substr(foo,6) from "users"."u"`);
		});
		it("should selectSub", function() {
			let sql = db.query().from("one").select(["foo", "bar"]).selectSub((b): Builder => {
				return b.from("two").select("baz").where("subkey", "subval");
			}, "subquery");
			expect(sql.toSql()).to.equal(`select "foo", "bar", (select "baz" from "two" where "subkey" = ?) as "subquery" from "one"`);
			expect(sql.getBindings()).to.eql(["subval"]);
		});
	});
	describe("where", function() {
		it("should where basic", function() {
			let query = db.query().select("*").where("id", "=", 1).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" = ?`);
			assert(JSON.stringify(query.getBindings()) === JSON.stringify([1]));
		});
		it("should whereNot basic", function() {
			let query = db.query().select("*").whereNot("id", 1).whereNot("id", "<>", 2).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where not "id" = ? and not "id" <> ?`);

			expect(query.getBindings()).to.eql([1, 2]);
		});
		it("should whereBetween", function() {
			let query = db.query().select("*").whereBetween("id", [1, 2]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" between ? and ?`);
			expect(query.getBindings()).to.eql([1, 2]);

		});
		it("should whereBetween raw", function() {
			let query = db.query().select("*").whereBetween("id", [new Expression(1), new Expression("2")]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" between 1 and 2`);
			expect(query.getBindings()).to.empty;
		});
		it("should whereBetween more", function() {
			let query = db.query().select("*").whereBetween("id", [1, 2, 3], "and", true).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" not between ? and ?`);
			expect(query.getBindings()).to.eql([1, 2]);

		});
		it("should whereBetweenColumns", function() {
			let query = db.query().select("*").whereBetweenColumns("id", ["users.created_at", "users.updated_at"]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" between "users"."created_at" and "users"."updated_at"`);
			expect(query.getBindings()).to.empty;
		});
		it("should orwhereBasic", function() {
			let query = db.query().select("*").where("id", 1).orWhere("age", 2).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" = ? or "age" = ?`);
			expect(query.getBindings()).to.eql([1, 2]);
		});
		it("should orwhereNot", function() {
			let query = db.query().select("*").whereNot("id", 1).orWhereNot("age", "<>", 2).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where not "id" = ? or not "age" <> ?`);
			expect(query.getBindings()).to.eql([1, 2]);
		});
		it("should whereRaw", function() {
			let query = db.query().select("*").whereRaw("id = ? or name = ?", [1, "aa"]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where id = ? or name = ?`);
			expect(query.getBindings()).to.eql([1, "aa"]);
		});
		it("should whereIn basic", function() {
			let query = db.query().select("*").whereIn("id", [1, 3, 7]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" in (?, ?, ?)`);
			expect(query.getBindings()).to.eql([1, 3, 7]);
			query = db.query().select("*").whereIn("id", [1, 3, 7]).orWhereIn("age", [2, 4, 6]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" in (?, ?, ?) or "age" in (?, ?, ?)`);
			expect(query.getBindings()).to.eql([1, 3, 7, 2, 4, 6]);
		});
		it("should whereNotIn basic", function() {
			let query = db.query().select("*").whereNotIn("id", [1, 3, 7]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" not in (?, ?, ?)`);
			expect(query.getBindings()).to.eql([1, 3, 7]);

			query = db.query().select("*").where("age", 18).orWhereNotIn("id", [1, 3, 7]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "age" = ? or "id" not in (?, ?, ?)`);
			expect(query.getBindings()).to.eql([18, 1, 3, 7]);
		});
		it("should whereColumn basic", function() {
			let query = db.query().select("*").whereColumn("first", "last").orWhereColumn("third", "middle").from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "first" = "last" or "third" = "middle"`);
			expect(query.getBindings()).to.empty;
		});
		it("should object or array of wheres", function() {
			let query = db.query().select("*").where([["age", ">", 18], ["name", "Jay"]]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where ("age" > ? and "name" = ?)`);
			expect(query.getBindings()).to.eql([18, "Jay"]);

			query = db.query().select("*").where([["age", ">", 18], { name: "Will", location: "LA" }]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where ("age" > ? and "name" = ? and "location" = ?)`);
			expect(query.getBindings()).to.eql([18, "Will", "LA"]);
		});
		it("should subselect whereIn", function() {
			let query = db.query().select("*").from("users").whereIn("id", (b: Builder): Builder => {
				return b.select("id").from("users").where("age", ">", 25).take(3);

			});
			expect(query.toSql()).to.equal(`select * from "users" where "id" in (select "id" from "users" where "age" > ? limit 3)`);
			expect(query.getBindings()).to.eql([25]);
		});

		it("should whereNested", function() {
			let query = db.query().select("*").where("age", ">", 30).where((b: Builder) => {
				return b.where("email", "like", "%@gmail").orWhere("name", "Walter");
			}).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "age" > ? and ("email" like ? or "name" = ?)`);
			expect(query.getBindings()).to.eql([30, "%@gmail", "Walter"]);
		});

		it("should whereNull", function() {
			let query = db.query().select("*").whereNull("id").from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" is null`);
			query = db.query().select("*").where("id").from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" is null`);
			query = db.query().select("*").whereNull(["id", "age"]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" is null and "age" is null`);
			expect(query.getBindings()).to.eql([]);
			query = db.query().select("*").where("name", "Bill").orWhereNull(["id", "age"]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "name" = ? or "id" is null or "age" is null`);
			expect(query.getBindings()).to.eql(["Bill"]);
		});
		it("should whereNotNull", function() {
			let query = db.query().select("*").whereNotNull("id").from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" is not null`);
			query = db.query().select("*").whereNotNull("id").orWhereNotNull(["name", "age"]).from("users");
			expect(query.toSql()).to.equal(`select * from "users" where "id" is not null or "name" is not null or "age" is not null`);
		});

	});

	it("should groupBys", function() {
		let query = db.query().select("*").groupBy("gender").from("users");
		expect(query.toSql()).to.equal(`select * from "users" group by "gender"`);
		query = db.query().select("*").groupBy(["gender", "country"]).from("users");
		expect(query.toSql()).to.equal(`select * from "users" group by "gender", "country"`);
		query = db.query().select("*").groupBy(new Expression("DATE(created_at)")).from("users");
		expect(query.toSql()).to.equal(`select * from "users" group by DATE(created_at)`);
	});
	it("should orderBy", function() {
		let query = db.query().select("*").orderBy("age").orderBy("rank", "desc").from("users");
		expect(query.toSql()).to.equal(`select * from "users" order by "age" asc, "rank" desc`);
		query = db.query().select("*").orderByRaw(`"age" ? desc`, ["foo"]).from("users");
		expect(query.toSql()).to.equal(`select * from "users" order by "age" ? desc`);
		query = db.query().select("*").orderBy((b: Builder): Builder => {
			return b.select("created_at").from("logins").whereColumn("user_id", "users.id").limit(1);
		}).from("users");
		expect(query.toSql()).to.equal(`select * from "users" order by (select "created_at" from "logins" where "user_id" = "users"."id" limit 1)`);

	});
	it("should havings", function() {
		let query = db.query().select("*").having("id", ">", 1).from("users");
		expect(query.toSql()).to.equal(`select * from "users" having "id" > ?`);

		query = db.query().select("*").where("id", "<", 10).groupBy("country").having("name", "Peter").orHaving("name", "Sophie").from("users");
		expect(query.toSql()).to.equal(`select * from "users" where "id" < ? group by "country" having "name" = ? or "name" = ?`);

		query = db.query().select("*").havingRaw("user_foo < ?", ["user_bar"]).having("name", "like", new Expression("Jim%s")).orHaving((b: Builder): Builder => {
			return b.having("country", "AU");
		}).from("users");
		expect(query.toSql()).to.equal(`select * from "users" having user_foo < ? and "name" like Jim%s or ("country" = ?)`);

		expect(query.getBindings()).to.eql(["user_bar", new Expression("Jim%s"), "AU"]);

	});
	it("should limit and offset", function() {
		let query = db.query().select("*").limit(5).offset(6).from("users");
		expect(query.toSql()).to.equal(`select * from "users" limit 5 offset 6`);
		query = db.query().select("*").take(0).skip(-6).from("users");
		expect(query.toSql()).to.equal(`select * from "users"`);

	});
	it("should paginate", function() {
		let query = db.query().select("*").from("users").forPage(2, 15);
		expect(query.toSql()).to.equal(`select * from "users" limit 15 offset 15`);


	});

	describe("update", function() {
		afterEach(() => {
			Sinon.restore();
		});
		it("should update object", function() {

			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Update");

			query.from("users").where("id", 1).update({
				email: "foo",
				name: "bar"
			});
			assert(connSpy.calledOnceWith(`update "users" set "email" = ?, "name" = ? where "id" = ?`, ["foo", "bar", 1]));


		});
		it("should update object raw", function() {
			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Update");
			query.from("users").where("id", 1).update({
				email: "foo",
				name: "bar",
				size: new Expression("size+1000"),
				meta: JSON.stringify(
					{
						type: "video/mp4",
						batch: 4,
						parts: [{ id: 1, etag: "etag1" }, { id: 2, etag: "etag2" }],
						key: "key",
						id: "id"
					})
			});
			assert(connSpy.calledOnceWith(`update "users" set "email" = ?, "name" = ?, "size" = size+1000, "meta" = ? where "id" = ?`, ["foo", "bar", `{"type":"video/mp4","batch":4,"parts":[{"id":1,"etag":"etag1"},{"id":2,"etag":"etag2"}],"key":"key","id":"id"}`, 1]));


		});
		it("should update map", function() {

			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Update");

			query.from("users").where("id", 1).update(new Map(Object.entries({
				email: "foo",
				name: "bar"
			})));
			assert(connSpy.calledOnceWith(`update "users" set "email" = ?, "name" = ? where "id" = ?`, ["foo", "bar", 1]));


		});
	});
	describe("delete", function() {
		afterEach(() => {
			Sinon.restore();
		});
		it("should delete", function() {
			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Delete");
			query.from("users").where("id", "<", 10).delete();
			assert(connSpy.calledOnceWith(`delete from "users" where "id" < ?`, [10]));
		});
		it("should delete by id", function() {
			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Delete");
			query.from("users").where("id", "<", 10).delete(1);
			assert(connSpy.calledOnceWith(`delete from "users" where "id" < ? and "users"."id" = ?`, [10, 1]));
		});
	});
	describe("insert", function() {
		afterEach(() => {
			Sinon.restore();
		});
		it("should insert single record object", function() {
			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Insert");
			query.from("users").insert({ email: "test@lite4d.org", name: "test insert" });
			assert(connSpy.calledOnceWith(`insert into "users" ("email", "name") values (?, ?)`, ["test@lite4d.org", "test insert"]));
		});
		it("should insert single record map", function() {
			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Insert");
			query.from("users").insert(new Map(Object.entries({ email: "test@lite4d.org", name: "test insert" })));
			assert(connSpy.calledOnceWith(`insert into "users" ("email", "name") values (?, ?)`, ["test@lite4d.org", "test insert"]));
		});

		it("should insert multiplte record object", function() {
			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Insert");
			query.from("users").insert([{ email: "test@lite4d.org", name: "test insert" }, {
				email: "test2@lite4d.org",
				name: "test multiple insert"
			}]);
			assert(connSpy.calledOnceWith(`insert into "users" ("email", "name") values (?, ?), (?, ?)`, ["test@lite4d.org", "test insert", "test2@lite4d.org", "test multiple insert"]));
		});
		it("should insert multiplte record map", function() {
			let query = db.query();
			const connSpy = Sinon.spy(query.connection, "Insert");
			query.from("users").insert([new Map(Object.entries({
				email: "test@lite4d.org",
				name: "test insert"
			})), new Map(Object.entries({ email: "test2@lite4d.org", name: "test multiple insert" }))]);
			assert(connSpy.calledOnceWith(`insert into "users" ("email", "name") values (?, ?), (?, ?)`, ["test@lite4d.org", "test insert", "test2@lite4d.org", "test multiple insert"]));
		});
	});
	//TODO aggregate
});
