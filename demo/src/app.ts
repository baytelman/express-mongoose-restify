import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as basicAuth from 'express-basic-auth';
import { Router } from 'express';
import { Model, model, Schema } from 'mongoose';
import * as mongoose from 'mongoose';

import { restifyModel } from 'express-mongoose-restify';

/* Demo Schema */
mongoose.connect(
  'mongodb://root:pass@localhost:27020/test-db?authSource=admin',
  { useNewUrlParser: true }
);

let TagSchema = new Schema({
  name: String,
  slug: { type: String, index: { unique: true } }
});
const Tag: Model<any> = model<any>('Tag', TagSchema);

let UserSchema = new Schema({
  name: String,
  email: String
});
const User: Model<any> = model<any>('User', UserSchema);

let PostSchema = new Schema({
  title: String,
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
  description: String,
  author: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [
    {
      author: { type: Schema.Types.ObjectId, ref: 'User' },
      comment: String
    }
  ]
});

PostSchema.plugin(require('mongoose-timestamp'));

const Post: Model<any> = model<any>('Post', PostSchema);
/* end of Demo Schema */

/* Setting up Express */
const app: express.Application = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
/* end of Setting up Express */

/*** EXPRESS+MONGOOSE+RESTIFY ****/

export const users = {
  felipe: 'password1',
  bruno: 'password2'
};
export const requestHandler = basicAuth({
  users: { ...users },
  challenge: true
});

const tagRouter: Router = Router();
restifyModel(tagRouter, Tag, { primaryKey: 'slug', requestHandler });
app.use('/api/tags', tagRouter);

const userRouter: Router = Router();
restifyModel(userRouter, User, { requestHandler });
app.use('/api/users', userRouter);

const postRouter: Router = Router();
restifyModel(postRouter, Post, { requestHandler });
app.use('/api/posts', postRouter);

/*** end of EXPRESS+MONGOOSE+RESTIFY ****/

const PORT: number = 5000;
app.listen(PORT);

module.exports = app;
