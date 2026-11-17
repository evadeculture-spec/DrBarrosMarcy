import { afterAll } from "vitest";
import { closeDb } from "../src/server/db";
afterAll(closeDb);
