import { Request, Response, Router } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { Model } from 'mongoose';

const convertModelToRest = (model: Model<any>, obj: any) => {
  const schema: any = model.schema;
  Object.keys(schema.paths).reduce(
    (map: any, key: string) => {
      map[key] = obj[key];
      return map;
    },
    { id: obj.id }
  );
};

export const listModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const { filter, range, sort } = req.query;
  const count = await model.count({});
  const conditions: any = {};
  if (filter) {
    const { q } = JSON.parse(filter);
    if (q) {
      /* Search for case-insensitive match on any field: */
      conditions['$or'] = Object.keys(model.schema.obj).map(k => ({
        [k]: new RegExp(q, 'i')
      }));
    }
  }
  let query = model.find(conditions);
  if (sort) {
    const [field, order] = JSON.parse(sort);
    query = query.sort({ [field]: order === 'ASC' ? 1 : -1 });
  }
  if (range) {
    const [start, end] = JSON.parse(range);
    query = query.skip(start).limit(end - start);
  }
  const all = (await query).map(c => convertModelToRest(model, c));
  res.header('Content-Range', `courses 0-${all.length - 1}/${count}`).json(all);
};

const matchCondition = (keyword: string, options?: MatchOptions) => {
  const condition =
    options && options.match ? { $or: options.match.map(field => ({ [field]: keyword })) } : { _id: keyword };
  console.log({ condition });
  return condition;
};

export const getModel = (model: Model<any>, options?: MatchOptions) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = convertModelToRest(model, await model.findOne(matchCondition(id, options)));
  res.json(obj);
};

export const deleteModel = (model: Model<any>, options?: MatchOptions) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = await model.findOneAndDelete(matchCondition(id, options));
  res.json(obj);
};

export const postModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const { body } = req;
  const instance = new model(body);
  await instance.save();
  res.json(convertModelToRest(model, instance));
};

export const putModel = (model: Model<any>, options?: MatchOptions) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const {
    body: { id: _, ...body }
  } = req;
  try {
    const instance = await model.findOneAndUpdate(
      matchCondition(id, options),
      {
        $set: body
      },
      { new: true }
    );
    res.json(convertModelToRest(model, instance));
  } catch (error) {
    console.log({ error });
    throw error;
  }
};

interface MatchOptions {
  match?: string[];
}

interface RestifyOptions extends MatchOptions {
  preprocesor?: RequestHandler;
  methods?: {
    get?: boolean;
    list?: boolean;
    post?: boolean;
    put?: boolean;
    delete?: boolean;
  };
}

export const restifyModel = (router: Router, model: Model<any>, { preprocesor, methods, match }: RestifyOptions) => {
  // List
  if (!methods || methods.list) {
    if (preprocesor) {
      router.route('/').get(preprocesor, listModel(model));
    } else {
      router.route('/').get(listModel(model));
    }
  }

  // Create one
  if (!methods || methods.post) {
    if (preprocesor) {
      router.route('/').post(preprocesor, postModel(model));
    } else {
      router.route('/').post(postModel(model));
    }
  }

  // Fetch one
  if (!methods || methods.get) {
    if (preprocesor) {
      router.route('/:id').get(preprocesor, getModel(model, { match }));
    } else {
      router.route('/:id').get(getModel(model, { match }));
    }
  }

  // Update one
  if (!methods || methods.put) {
    if (preprocesor) {
      router.route('/:id').put(preprocesor, putModel(model, { match }));
      router.route('/:id').patch(preprocesor, putModel(model, { match }));
    } else {
      router.route('/:id').put(putModel(model, { match }));
      router.route('/:id').patch(putModel(model, { match }));
    }
  }

  // Delete one
  if (!methods || methods.delete) {
    if (preprocesor) {
      router.route('/:id').delete(preprocesor, deleteModel(model, { match }));
    } else {
      router.route('/:id').delete(deleteModel(model, { match }));
    }
  }
};
