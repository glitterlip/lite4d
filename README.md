# lite4d

Query Builder for cloudflare D1 database

## Installation

```
npm install lite4d
```

For yarn

```
yarn add lite4d
```

## Usage

<details>
  <summary>Exmaple Set Up</summary>

### Table structure

```
CREATE TABLE "student_test" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "score" TEXT NOT NULL,
  "class_id" INTEGER NOT NULL,
  "email" TEXT,
  PRIMARY KEY ("id")
);
```

### Wrangler setting

```
[[d1_databases]]
binding = "TEST"
database_name = "worker"
preview_database_id = ""
database_id = ""
```

//typescript types

```ts
export interface Student {
	id: number;
	name: string;
	age: number;
	score: string;
	class_id: number;
	email?: string;
}
```

`

</details>

### Binding

```ts
import Lite4D from "lite4d/lib/database";

const DB = () => {
	//set the connection:D1Database
	return (new Lite4D()).connection(env.TEST)
}

//if you are using honojs
import { Context, Hono } from "hono";

const DB = (c: Context) => {
	return (new Lite4D()).connection(c.env.TEST)
}
```

### Get a QueryBuilder

```ts
(new Lite4D()).connection(c.env.TEST).query()
	//get a query builder
	(new Lite4D()).connection(c.env.TEST).table('student_test')
//get a builder and set the table
```

#### Insert

```ts
//object
await DB(c).table('student_test').insert({
	name: 'Joe',
	age: 16,
	score: 99,
	class_id: 1,
})
//map
await DB(c).table('student_test').insert(new Map(Object.entries({
	name: 'John',
	age: 26,
	score: 49,
	class_id: 5,
	email: 'john@uc.edu'
})))
//array
await DB(c).table('student_test').insert([
	{
		name: 'Jeff',
		age: 18,
		score: 76,
		class_id: 3,
		email: 'jeff@uca.edu'
	}, {
		name: 'Jean',
		age: 24,
		score: 88,
		class_id: 3,
		email: 'Jean@ucd.edu'
	}])
```

<details>
  <summary>Wrangler result</summary>

run ` wrangler d1 execute worker --command="select * from student_test"`

```
┌────┬──────┬─────┬───────┬──────────┬──────────────┐
│ id │ name │ age │ score │ class_id │ email        │
├────┼──────┼─────┼───────┼──────────┼──────────────┤
│ 1  │ Joe  │ 16  │ 99    │ 1        │              │
├────┼──────┼─────┼───────┼──────────┼──────────────┤
│ 2  │ John │ 26  │ 49    │ 5        │ john@uc.edu  │
├────┼──────┼─────┼───────┼──────────┼──────────────┤
│ 3  │ Jeff │ 18  │ 76    │ 3        │ jeff@uca.edu │
├────┼──────┼─────┼───────┼──────────┼──────────────┤
│ 4  │ Jean │ 24  │ 88    │ 3        │ Jean@ucd.edu │
└────┴──────┴─────┴───────┴──────────┴──────────────┘
```

</details>

#### Query

##### Single Row

```ts
//first return null|Student
await DB(c).table('student_test').where('id', 1).first<Student>()
//if table has a id column as primary key
await DB(c).table('student_test').find<Student>(1)
```

#### Rows

get returns a Promise<D1Result<T>>

```ts
await DB(c).table('student_test').where('id', '>', 1).get<Student>()
```

<details>
  <summary>get result </summary>

```
{
	"results": [
	{
		"id": 2,
		"name": "John",
		"age": 26,
		"score": "49",
		"class_id": 5,
		"email": "john@uc.edu"
	},
	{
		"id": 3,
		"name": "Jeff",
		"age": 18,
		"score": "76",
		"class_id": 3,
		"email": "jeff@uca.edu"
	},
	{
		"id": 4,
		"name": "Jean",
		"age": 24,
		"score": "88",
		"class_id": 3,
		"email": "Jean@ucd.edu"
	}
],
	"duration": 1.9804509999230504,
	"lastRowId": null,
	"changes": null,
	"success": true,
	"served_by": "primary-77233d31-307c-43d7-90a1-3bb521c6a8c4.db3",
	"meta": {
	"duration": 1.9804509999230504,
		"last_row_id": null,
		"changes": null,
		"served_by": "primary-77233d31-307c-43d7-90a1-3bb521c6a8c4.db3",
		"internal_stats": null
}
}
```

</details>

##### Single Column

value returns a single column or null

```ts
await DB(c).table('student_test').where('name', 'John').value<string>('email')
// john@uc.edu

await DB(c).table('student_test').where('name', 'Je').value<string>('email')
//null
```

##### List of columns

only id,name and email column pls

```ts
await DB(c).table('student_test').select(['name', 'email', 'id']).get<{ name: string, email: string, id: number }>()
await DB(c).table('student_test').get<{ name: string, email: string, id: number }>(['name', 'email', 'id'])
```

##### Aggregate

```ts
await DB(c).table('student_test').where('score', '>', 60).count()
//3
await DB(c).table('student_test').where('score', '>', 60).count('id')
//3
await DB(c).table('student_test').where('class_id', 3).avg('score')
//82
await DB(c).table('student_test').max('score')
//99
```

##### Raw Expressions

```ts
await DB(c).table('student_test').select(['name', new Expression('email as school_email')]).where('id', 2).first<{ name: string, school_email: string }>()
//result 
{
	name:"John",
	school_email:"john@uc.edu"
}
```

### Where Clauses

Use the builder's `where` method to add a `where` clauses to the query.

Basiclly where method needs three arguements.

First one is column,second is operator , third one is value.

If you only pass two arguements,we will assume that operator is `=`.

#### multiple where clauses

```ts
DB(c).query().select("*").where([["age", ">", 18], ["name", "Jay"]]).from("users")
//select * from "users" where ("age" > ? and "name" = ?)

DB(c).query().select("*").where([["age", ">", 18], { name: "Will", location: "LA" }]).from("users")
//select * from "users" where ("age" > ? and "name" = ? and "location" = ?)
```

#### orWhere

```ts
DB(c).query().select("*").where("id", 1).orWhere("age", 2).from("users")
//select * from "users" where "id" = ? or "age" = ?
```

#### whereNot/orWhereNot

```ts
DB(c).query().select("*").whereNot("id", 1).whereNot("id", "<>", 2).from("users")
//select * from "users" where not "id" = ? and not "id" <> ?
DB(c).query().select("*").whereNot("id", 1).orWhereNot("age", "<>", 2).from("users")
//select * from "users" where not "id" = ? or not "age" <> ?
```

#### whereBetween/orWhereBetween

```ts
DB(c).query().select("*").whereBetween("id", [1, 2]).from("users");
//select * from "users" where "id" between ? and ?
```

#### whereBetweenColumns

```ts
DB(c).query().select("*").whereBetweenColumns("id", ["users.created_at", "users.updated_at"]).from("users");
//select * from "users" where "id" between "users"."created_at" and "users"."updated_at"
```

#### whereIn/whereNotIn

```ts
DB(c).query().select("*").whereIn("id", [1, 3, 7]).orWhereIn("age", [2, 4, 6]).from("users");
//select * from "users" where "id" in (?, ?, ?) or "age" in (?, ?, ?)
```

#### whereNull/orWhereNull/whereNotNull/whereNotNull/orWhereNotNull

```ts
DB(c).query().select("*").whereNull("id").from("users");
//select * from "users" where "id" is null
```

#### whereColumn/orWhereColumn

```ts
DB(c).query().select("*").whereColumn("first", "last").orWhereColumn("third", "middle").from("users");
//select * from "users" where "first" = "last" or "third" = "middle"
```

#### Logical group/Nested Where

```ts
DB(c).query().select("*").where('age', '>', 30).where((b: Builder) => {
	return b.where("email", "like", "%@gmail").orWhere("name", "Walter");
}).from("users");
//select * from "users" where "age" > ? and ("email" like ? or "name" = ?)
```

### Limit/Offset/Paginate

```ts
DB(c).query().select("*").limit(5).offset(6).from("users");
//select * from "users" limit 5 offset 6

DB(c).query().select("*").take(0).skip(-6).from("users");
//select * from "users"
DB(c).query().select("*").from("users").forPage(2, 15);
//select * from "users" limit 15 offset 15
DB(c).query().select("*").from("users").paginate<T>(2, 15);
//returns a Paginator<T>
```

### orderBy/orderByRaw

```ts
DB(c).query().select("*").orderBy("age").orderBy("rank", "desc").from("users");
//select * from "users" order by "age" asc, "rank" desc
DB(c).query().select("*").orderByRaw(`"age" ? desc`, ["foo"]).from("users");
//select * from "users" order by "age" ? desc
DB(c).query().select("*").orderBy((b: Builder): Builder => {
	return b.select("created_at").from("logins").whereColumn("user_id", "users.id").limit(1);
}).from("users");
//select * from "users" order by (select "created_at" from "logins" where "user_id" = "users"."id" limit 1)
```

## Update

update can take object or map as arguement

```ts
let query = DB(c).query();

query.from("users").where("id", 1).update({
	email: "foo",
	name: "bar"
});
//update "users" set "email" = ?, "name" = ? where "id" = ?`
```

update use raw

```ts
let query = DB(c).query();
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
//update "users" set "email" = ?, "name" = ?, "size" = size+1000, "meta" = ? where "id" = ?`, ["foo", "bar", `{"type":"video/mp4","batch":4,"parts":[{"id":1,"etag":"etag1"},{"id":2,"etag":"etag2"}],"key":"key","id":"id"}`, 1]));
```

## Insert

intert can take object/map/array of map/array of object as arguement

```ts
let query = DB(c).query();
query.from("users").insert({ email: "test@lite4d.org", name: "test insert" });
//insert into "users" ("email", "name") values (?, ?)
let query = DB(c).query();
query.from("users").insert(new Map(Object.entries({ email: "test@lite4d.org", name: "test insert" })));
//insert into "users" ("email", "name") values (?, ?)
let query = DB(c).query();
query.from("users").insert([{ email: "test@lite4d.org", name: "test insert" }, {
	email: "test2@lite4d.org",
	name: "test multiple insert"
}]);
//insert into "users" ("email", "name") values (?, ?), (?, ?)
let query = DB(c).query();
query.from("users").insert([new Map(Object.entries({
	email: "test@lite4d.org",
	name: "test insert"
})), new Map(Object.entries({ email: "test2@lite4d.org", name: "test multiple insert" }))]);
//insert into "users" ("email", "name") values (?, ?), (?, ?)
```

## Delete

```ts
let query = db.query();
query.from("users").where("id", "<", 10).delete();
//delete from "users" where "id" < ?
let query = db.query();
query.from("users").where("id", "<", 10).delete(1);
//delete from "users" where "id" < ? and "users"."id" = ?
```

## Debug

Most of the methods will eventually call d1 client api.
use `pretend()` to get prevent sql executing and get query and bindings[](https://)

```ts
await DB(c).table('student_test').pretend().where('id','<',10).delete()
//this query will not execute,instead it returns an object
{
	"query": "delete from \"student_test\" where \"id\" < ?",
	"bindings": [
	  10
    ]
}
```

use this feature to check the sql when you get an unexpected result

## Further more

There are more examples in [test case](https://github.com/glitterlip/lite4d/blob/main/test/builder.test.ts) you can check

