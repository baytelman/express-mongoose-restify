# express-mongoose-restify

One-line restify MongoDB models, compatible with https://marmelab.com/react-admin and https://github.com/baytelman/react-admin-auto

## Why

React-Admin is a great tool to quickly create ReactJS-driven internal admin panels for your company.

However, building a flavored RESTful API that matches all the requirements of React-Admin is a tedious task.

## Install

The tool is written in Node.js, but you can use it to run **any** commands.

```bash
yarn add express-mongoose-restify
```

```javascript
import { Model, Schema } from 'mongoose';
import { Router } from 'express';
import { restifyModel } from 'express-mongoose-restify';

let PostSchema = new Schema({
    /* your Mongoose schema */
});

const Post: Model<any> = model<any>('Post', PostSchema);

/* Your express router */
const postRouter: Router = Router();
restifyModel(postRouter, Post);
app.use('/api/posts', postRouter);
```

Will automatically generate
```
GET http://localhost:3000/api/posts
POST http://localhost:3000/api/posts
GET http://localhost:3000/api/posts/:id
PUT http://localhost:3000/api/posts/:id
PATCH http://localhost:3000/api/posts/:id
DELETE http://localhost:3000/api/posts/:id
```

**Features:**

* Enable/disable specific methods (GET, LIST, POST, PUT/PATCH, DELETE).
* LIST:
    * Field Filters (URL-encoded `?filter={"key":["value1", "value2"]})` for exact field match.
    * RegEx Filters (URL-encoded `?filter={"q":"needle"})` to regex match any text field of your model.
    * Range and sort (URL-encoded `?range=[100,125]&sort=["field", "ASC"]`)
* RequestHandler (`requestHandler` option), allowing you to add Auth or any other handler.
* Enable additional fields as identifiers (`match` option) for GET/PUT/PATCH/DELETE:
    * Useful if you need to search for id and slugs, or other unique identifiers.
    * GET /api/posts/:id
    * GET /api/posts/:slug|:id (`match: ['slug']`)
* Entry processing:
    * Fake id/primary key (`primaryKey` option): Use any unique attribute as Id – Useful when you have unique slugs and you don't want to display a mongo id.
    * Pre-process entities before storing them (`preprocessor ` option).
* Spawns commands with [spawn-command](https://github.com/mmalecki/spawn-command)

**Demo:**
```js
const postRouter: Router = Router();
/* Load your router: */
restifyModel(postRouter, Post, {
    primaryKey: 'md5', /* Will use DB field 'md5' as 'id' in generated JSONs */  
    match: ['slug', 'sha'], /* Will allow id (internally md5), slug or sha as identifier (`GET /api/posts/:id|:slug|:sha`) */
    preprocessor: basicAuth({users: { /* */ }, challenge: true), /* Protects with basicAuth */
    methods: {list: true, get: true, put: true, post: true}, /* Limits allowed methods, in this case no DEL */
});
/* Add your router to your app */
app.use('/api/posts', postRouter);
```
