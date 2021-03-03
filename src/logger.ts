import { pluginName } from "./constants";
import type * as ts from "typescript/lib/tsserverlibrary";

export class LanguageServiceLogger {
    constructor(private readonly info: ts.server.PluginCreateInfo) {}

    public log(msg: string | undefined) {
        if (msg) {
            this.info.project.projectService.logger.info(
                `[${pluginName}] ${msg}`
            );
        }
    }
}
