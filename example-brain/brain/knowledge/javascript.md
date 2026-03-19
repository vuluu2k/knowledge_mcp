---
name: JavaScript
description: Kiến thức cơ bản và nâng cao về JavaScript
tags: javascript, js, frontend, backend, node
---

## var vs let vs const

- `var`: function-scoped, hoisted, có thể re-declare → tránh dùng
- `let`: block-scoped, có thể reassign
- `const`: block-scoped, không thể reassign (nhưng object/array bên trong vẫn mutable)

```js
const arr = [1, 2, 3];
arr.push(4); // OK — array vẫn mutable
arr = [];    // Error — không thể reassign
```

## Promise vs async/await

Promise là cách xử lý bất đồng bộ trong JS. async/await là syntax sugar cho Promise.

```js
// Promise
fetch(url).then(res => res.json()).then(data => console.log(data));

// async/await — dễ đọc hơn
const res = await fetch(url);
const data = await res.json();
console.log(data);
```

Lưu ý: `await` chỉ dùng được trong `async function` hoặc top-level module.

## Destructuring

Trích xuất giá trị từ object/array:

```js
// Object destructuring
const { name, age } = user;

// Array destructuring
const [first, ...rest] = items;

// Rename
const { name: userName } = user;

// Default value
const { role = "guest" } = user;
```

## Event Loop

JS là single-threaded nhưng non-blocking nhờ event loop:

1. Call stack chạy code đồng bộ
2. Web APIs xử lý async (setTimeout, fetch...)
3. Callback queue chờ call stack trống
4. Event loop chuyển callback từ queue → stack

Microtask (Promise) được ưu tiên trước macrotask (setTimeout).
