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

let UserSchema = new Schema({
  name: String,
  email: String
});

let PostSchema = new Schema({
  title: String,
  tags: [String],
  description: String,
  author: UserSchema,
  comments: [
    {
      author: UserSchema,
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
export const authentication = basicAuth({
  users: { ...users },
  challenge: true
});

const router: Router = Router();
restifyModel(router, Post, { preprocesor: authentication });
app.use('/api/posts', router);
/*** end of EXPRESS+MONGOOSE+RESTIFY ****/ 

const PORT: number = 5000;
app.listen(PORT);

module.exports = app;
