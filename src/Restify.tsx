import { Request, Response, Router } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { Model } from 'mongoose';

const convertModelToRest = (model: Model<any>, obj: any) => {
  const map: any = { id: obj.id };
  const schema: any = model.schema;
  Object.keys(schema.paths).forEach((key: string) => {
    map[key] = obj[key];
  });
  return map;
};

export const listModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const { filter, range, sort } = req.query;
  const count = await model.count({});
  const conditions: any = {};
  if (filter) {
    const { q } = JSON.parse(filter);
    if (q) {
      /* Search for case-insensitive match on any field: */
      conditions['$or'] = Object.keys(model.schema.obj).map(k => ({ [k]: new RegExp(q, 'i') }));
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

export const getModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = convertModelToRest(model, await model.findById(id));
  res.json(obj);
};

export const deleteModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const obj = await model.findByIdAndDelete(id);
  res.json(obj);
};

export const postModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const { body } = req;
  const instance = new model(body);
  await instance.save();
  res.json(convertModelToRest(model, instance));
};

export const putModel = (model: Model<any>) => async (req: Request, res: Response) => {
  const id = req.params.id;
  const {
    body: { id: _, ...body }
  } = req;
  try {
    const instance = await model.findOneAndUpdate(
      { _id: id },
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

export const restifyModel = (
  router: Router,
  model: Model<any>,
  {
    preprocesor,
    methods
  }: {
    preprocesor?: RequestHandler;
    methods?: { get?: boolean; list?: boolean; post?: boolean; put?: boolean; delete?: boolean };
  }
) => {
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
      router.route('/:id').get(preprocesor, getModel(model));
    } else {
      router.route('/:id').get(getModel(model));
    }
  }

  // Update one
  if (!methods || methods.put) {
    if (preprocesor) {
      router.route('/:id').put(preprocesor, putModel(model));
      router.route('/:id').patch(preprocesor, putModel(model));
    } else {
      router.route('/:id').put(putModel(model));
      router.route('/:id').patch(putModel(model));
    }
  }

  // Delete one
  if (!methods || methods.delete) {
    if (preprocesor) {
      router.route('/:id').delete(preprocesor, deleteModel(model));
    } else {
      router.route('/:id').delete(deleteModel(model));
    }
  }
};
