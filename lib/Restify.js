"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const IGNORE_PROPS_EDIT = ['createdAt', 'updatedAt', 'id', '_id'];
const preprocess = (obj, preprocessor) => {
    IGNORE_PROPS_EDIT.forEach(prop => delete obj[prop]);
    if (preprocessor) {
        return preprocessor(obj);
    }
    return obj;
};
const convertModelToRest = (model, obj, options) => {
    const schema = model.schema;
    return (obj &&
        Object.keys(schema.paths).reduce((map, key) => {
            if (key !== options.primaryKey) {
                map[key] = obj[key];
            }
            return map;
        }, { id: obj[options.primaryKey || 'id'] }));
};
exports.listModel = (model, options) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { filter, range, sort } = req.query;
    const conditions = {};
    if (filter) {
        const { q } = JSON.parse(filter);
        if (q) {
            const schema = model.schema;
            const combinedOr = Object.keys(schema.paths)
                .filter(k => schema.paths[k].instance === 'String' ||
                schema.paths[k].instance === 'ObjectID' ||
                schema.paths[k].instance === 'Number')
                .map(k => {
                switch (schema.paths[k].instance) {
                    case 'String':
                        return {
                            [k]: new RegExp(q, 'i')
                        };
                    case 'ObjectID':
                        return mongoose_1.Types.ObjectId.isValid(q)
                            ? {
                                [k]: q
                            }
                            : null;
                    case 'Number':
                        return !isNaN(parseInt(q))
                            ? {
                                [k]: parseInt(q)
                            }
                            : null;
                }
            })
                .filter(condition => !!condition);
            if (combinedOr.length > 0) {
                conditions['$or'] = combinedOr;
            }
        }
    }
    const count = yield model.count(conditions);
    let query = model.find(conditions);
    if (sort) {
        const [field, order] = JSON.parse(sort);
        query = query.sort({
            [options && options.primaryKey && field === 'id' ? options.primaryKey : field]: order === 'ASC' ? 1 : -1
        });
    }
    if (range) {
        const [start, end] = JSON.parse(range);
        query = query.skip(start).limit(end - start);
    }
    const all = (yield query).map(c => convertModelToRest(model, c, options));
    res.header('Content-Range', `${model.name} 0-${all.length - 1}/${count}`).json(all);
});
const matchCondition = (keyword, options) => {
    const condition = options && options.match
        ? {
            $or: [
                ...(options && options.primaryKey ? [options.primaryKey] : mongoose_1.Types.ObjectId.isValid(keyword) ? ['_id'] : []),
                ...options.match
            ].map(field => ({
                [field]: keyword
            }))
        }
        : {
            [(options && options.primaryKey) || '_id']: (((options && options.primaryKey) || mongoose_1.Types.ObjectId.isValid(keyword)) && keyword) || null
        };
    return condition;
};
exports.getModel = (model, options) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const obj = convertModelToRest(model, yield model.findOne(matchCondition(id, options)), options);
    res.json(obj);
});
exports.deleteModel = (model, options) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const obj = yield model.findOneAndDelete(matchCondition(id, options));
    res.json(convertModelToRest(model, obj, options));
});
exports.postModel = (model, { primaryKey, preprocessor }) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    let { body } = req;
    body = preprocess(body, preprocessor);
    const instance = new model(body);
    yield instance.save();
    res.json(convertModelToRest(model, instance, { primaryKey }));
});
exports.putModel = (model, { options }) => (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    let _a = req.body, { id: _ } = _a, body = __rest(_a, ["id"]);
    body = preprocess(body, options.preprocessor);
    try {
        const instance = yield model.findOneAndUpdate(matchCondition(id, options), {
            $set: body
        }, { new: true });
        res.json(convertModelToRest(model, instance, options));
    }
    catch (error) {
        console.log({ error });
        throw error;
    }
});
exports.restifyModel = (router, model, { primaryKey, requestHandler, methods, match, preprocessor }) => {
    if (!methods || methods.list) {
        if (requestHandler) {
            router.route('/').get(requestHandler, exports.listModel(model, { primaryKey }));
        }
        else {
            router.route('/').get(exports.listModel(model, { primaryKey }));
        }
    }
    if (!methods || methods.post) {
        if (requestHandler) {
            router.route('/').post(requestHandler, exports.postModel(model, { primaryKey, preprocessor }));
        }
        else {
            router.route('/').post(exports.postModel(model, { primaryKey, preprocessor }));
        }
    }
    if (!methods || methods.get) {
        if (requestHandler) {
            router.route('/:id').get(requestHandler, exports.getModel(model, { primaryKey, match }));
        }
        else {
            router.route('/:id').get(exports.getModel(model, { primaryKey, match }));
        }
    }
    if (!methods || methods.put) {
        if (requestHandler) {
            router.route('/:id').put(requestHandler, exports.putModel(model, { options: { primaryKey, match, preprocessor } }));
            router.route('/:id').patch(requestHandler, exports.putModel(model, { options: { primaryKey, match, preprocessor } }));
        }
        else {
            router.route('/:id').put(exports.putModel(model, { options: { primaryKey, match, preprocessor } }));
            router.route('/:id').patch(exports.putModel(model, { options: { primaryKey, match, preprocessor } }));
        }
    }
    if (!methods || methods.delete) {
        if (requestHandler) {
            router.route('/:id').delete(requestHandler, exports.deleteModel(model, { primaryKey, match }));
        }
        else {
            router.route('/:id').delete(exports.deleteModel(model, { primaryKey, match }));
        }
    }
};
//# sourceMappingURL=Restify.js.map