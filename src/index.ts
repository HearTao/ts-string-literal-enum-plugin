import type * as ts from "typescript/lib/tsserverlibrary";
import { StringLiteralEnumPlugin } from "./plugin";

export = (mod: { typescript: typeof ts }) =>
    new StringLiteralEnumPlugin(mod.typescript);
