import type * as ts from "typescript/lib/tsserverlibrary";
import { LanguageServiceLogger } from "./logger";
import { RefactorLanguageServiceProxy } from "./decorator";
import { CustomizedLanguageService } from "./service";
import { SynchronizedConfiguration } from "./types";

export class StringLiteralEnumPlugin {
    private logger?: LanguageServiceLogger;

    constructor(private readonly typescript: typeof ts) {}

    create(info: ts.server.PluginCreateInfo) {
        const config: SynchronizedConfiguration = info.config ?? {};
        this.logger = new LanguageServiceLogger(info);
        this.logger.log("create config: " + JSON.stringify(config));

        return new RefactorLanguageServiceProxy(
            new CustomizedLanguageService(info, this.typescript, this.logger)
        ).decorate(info.languageService);
    }
}
