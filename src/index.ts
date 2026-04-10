import "./env";
import app from "./app";
import { db } from "./lib/db";

export default {
  port: 3000,
  fetch: app.fetch,
  bindings: {
    db,
  },
};
