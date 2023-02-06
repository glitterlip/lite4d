export class Paginator<T> {
	total: number;
	per_page: number;
	current_page: number;
	last_page: number;
	from: number;
	to: number;
	items: Array<T>;

	constructor(items: Array<T>, total: number, perPage: number, page: number) {
		this.items = items;
		this.total = total;
		this.per_page = perPage;
		this.current_page = page;
		this.last_page = Math.max(1, Math.ceil(this.total / this.per_page));
		this.from = this.items.length ? (this.per_page * (this.current_page - 1) + 1) : 0;
		this.to = this.items.length ? this.from + this.items.length - 1 : 0;
	}

}
