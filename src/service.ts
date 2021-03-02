import type * as ts from "typescript/lib/tsserverlibrary";

import {
    convertEnumIntoStringLiteralActionName,
    convertEnumMemberIntoStringLiteralActionName,
    refactorDescriptions,
    refactorName
} from "./constants";
import { ICustomizedLanguageServie } from "./decorator";
import { LanguageServiceLogger } from "./logger";
import {
    EnumOrEnumMember,
    Err,
    Ok,
    OkType,
    RefactorContext,
    Result
} from "./types";
import {
    assert,
    getPositionOfPositionOrRange,
    isConvertibleEnumMember,
    kindToActionNameAndDesc
} from "./utils";

export class CustomizedLanguageService implements ICustomizedLanguageServie {
    constructor(
        private readonly info: ts.server.PluginCreateInfo,
        private readonly typescript: typeof ts,
        private readonly logger: LanguageServiceLogger
    ) {}

    getApplicableRefactors(
        fileName: string,
        positionOrRange: number | ts.TextRange,
        preferences: ts.UserPreferences | undefined
    ): ts.ApplicableRefactorInfo[] {
        const context = this.getRefactorContext(fileName);
        if (!context) {
            this.logger.log("Cannot construct refactor context");
            return [];
        }

        const ts = this.typescript;
        const { file } = context;
        const targetInfo = this.getTargetInfo(
            file,
            getPositionOfPositionOrRange(positionOrRange)
        );

        if (targetInfo.type !== OkType.Ok) {
            this.logger.log(targetInfo.reason);
            if (
                !preferences?.provideRefactorNotApplicableReason ||
                !targetInfo.extra
            ) {
                return [];
            }

            const [actionName, actionDescription] = kindToActionNameAndDesc(
                targetInfo.extra,
                ts
            );
            return [
                {
                    name: refactorName,
                    description: refactorDescriptions,
                    actions: [
                        {
                            name: actionName,
                            description: actionDescription,
                            notApplicableReason: targetInfo.reason
                        }
                    ]
                }
            ];
        }

        const [actionName, actionDescription] = kindToActionNameAndDesc(
            targetInfo.value.kind,
            ts
        );
        return [
            {
                name: refactorName,
                description: refactorDescriptions,
                actions: [
                    {
                        name: actionName,
                        description: actionDescription
                    }
                ]
            }
        ];
    }

    getEditsForRefactor(
        fileName: string,
        formatOptions: ts.FormatCodeSettings,
        positionOrRange: number | ts.TextRange,
        refactor: string,
        actionName: string,
        preferences: ts.UserPreferences | undefined
    ) {
        if (
            refactor !== refactorName ||
            (actionName !== convertEnumIntoStringLiteralActionName &&
                actionName !== convertEnumMemberIntoStringLiteralActionName)
        ) {
            return undefined;
        }

        const context = this.getRefactorContext(fileName);
        if (!context) {
            this.logger.log("Cannot construct refactor context");
            return undefined;
        }

        const ts = this.typescript;
        const { file } = context;

        const targetInfo = this.getTargetInfo(
            file,
            getPositionOfPositionOrRange(positionOrRange)
        );
        if (targetInfo.type !== OkType.Ok) {
            this.logger.log(targetInfo.reason);
            return undefined;
        }

        return this.doInTextChanges(
            formatOptions,
            preferences,
            changeTracker => {
                if (ts.isEnumDeclaration(targetInfo.value)) {
                    this.doChangesForEnumDeclaration(
                        file,
                        targetInfo.value,
                        changeTracker
                    );
                } else {
                    this.doChangesForEnumMember(
                        file,
                        targetInfo.value,
                        changeTracker
                    );
                }
            }
        );
    }

    doInTextChanges(
        formatOptions: ts.FormatCodeSettings,
        preferences: ts.UserPreferences | undefined,
        cb: (changeTracker: ts.textChanges.ChangeTracker) => void
    ) {
        const formatContext = this.typescript.formatting.getFormatContext(
            formatOptions
        );
        const textChangesContext: ts.textChanges.TextChangesContext = {
            formatContext,
            host: this.info.languageServiceHost,
            preferences: preferences || {}
        };

        const edits = this.typescript.textChanges.ChangeTracker.with(
            textChangesContext,
            cb
        );

        return {
            edits
        };
    }

    getTargetInfo(
        file: ts.SourceFile,
        pos: number
    ): Result<EnumOrEnumMember, EnumOrEnumMember["kind"]> {
        const ts = this.typescript;
        if (file.isDeclarationFile) {
            return Err("Cannot convert in d.ts files");
        }

        const currentToken = ts.getTokenAtPosition(file, pos);
        if (
            !ts.isStringLiteral(currentToken) &&
            !ts.isIdentifier(currentToken)
        ) {
            return Err("Cannot find string or identifier in selection");
        }
        if (
            (!ts.isEnumDeclaration(currentToken.parent) &&
                !ts.isEnumMember(currentToken.parent)) ||
            currentToken.parent.name !== currentToken
        ) {
            return Err("Cannot find enum declaration in selection");
        }

        if (ts.isEnumDeclaration(currentToken.parent)) {
            if (!currentToken.parent.members.some(isConvertibleEnumMember)) {
                return Err(
                    "Enum declaration cannot be convert",
                    currentToken.parent.kind
                );
            }
            return Ok(currentToken.parent);
        } else {
            if (!isConvertibleEnumMember(currentToken.parent)) {
                return Err(
                    "Enum member cannot be convert",
                    currentToken.parent.kind
                );
            }
            return Ok(currentToken.parent);
        }
    }

    doChangesForEnumDeclaration(
        file: ts.SourceFile,
        enumDecl: ts.EnumDeclaration,
        changeTracker: ts.textChanges.ChangeTracker
    ) {
        enumDecl.members
            .filter(isConvertibleEnumMember)
            .forEach(member =>
                this.doChangesForEnumMember(file, member, changeTracker)
            );
    }

    doChangesForEnumMember(
        file: ts.SourceFile,
        enumMember: ts.EnumMember,
        changeTracker: ts.textChanges.ChangeTracker
    ) {
        const ts = this.typescript;
        assert(!enumMember.initializer, "Enum member cannot have initializer");
        assert(
            ts.isIdentifier(enumMember.name) ||
                ts.isStringLiteral(enumMember.name),
            "Name of Enum member can only be identifier or string literal"
        );

        changeTracker.replaceNode(
            file,
            enumMember,
            ts.factory.updateEnumMember(
                enumMember,
                enumMember.name,
                ts.factory.createStringLiteral(enumMember.name.text)
            )
        );
    }

    getRefactorContext(fileName: string): RefactorContext | undefined {
        const program = this.info.languageService.getProgram();
        if (!program) {
            this.logger.log("Cannot find program");
            return undefined;
        }

        const file = program.getSourceFile(fileName);
        if (!file) {
            this.logger.log("Cannot find source file");
            return undefined;
        }

        return {
            file,
            program
        };
    }
}
