import crypto from 'crypto';
import { buildPage } from './module/pageBuilder';
import { PipelineCache } from './pipelineCache';
import { ResourceParser } from './module/resourceParser';
import { HtmlCompiler } from './module/htmlCompiler';
import { DocumentNode, PipelineInterface, HtmlFormatter, Page, Fragment, ResourceType, FragmentContext, ScopeData } from '..';
import { Component } from './object/component';
import { EvalContext, isExpressionString, EvalContent, parseExpression, parseScript, createFragmentScope } from './module/evalEngine';
import { bindStyle } from './module/resourceBinder';
import { StandardHtmlFormatter } from './module/standardHtmlFormatter';

/**
 * Primary compilation pipeline.
 * Takes one raw, uncompiled page from the pipeline input, and writes one compiled, pure-html page to the pipeline output.
 * The produced page is fully compiled and ready to be rendered by a standard web browser.
 * Additionally, it will be formatted by any HTML Formatter provided.
 * 
 * Any incidental resources (such as stylesheets) will be fed to the pipeline interface via createResource().
 */
export class StandardPipeline {
    /**
     * Caches reusable data for the pipline
     */
    private readonly cache: PipelineCache;

    /**
     * Frontend / Backend for the pipeline
     */
    readonly pipelineInterface: PipelineInterface;
    
    /**
     * HTML formatter, if provided
     */
    readonly htmlFormatter: HtmlFormatter;

    /**
     * General content parser
     */
    readonly resourceParser: ResourceParser;

    /**
     * HTML compilation support
     */
    readonly htmlCompiler: HtmlCompiler;

    /**
     * Create a new instance of the pipeline
     * @param pipelineInterface Pipeline interface instance
     * @param htmlFormatter Optional HTML formatter to use
     * @param resourceParser Optional override for standard ResourceParser
     * @param htmlCompiler Optional override for standard HtmlCompiler
     * @param resourceBinder Optional override for standard ResourceBinder
     */
    constructor(pipelineInterface: PipelineInterface, htmlFormatter?: HtmlFormatter, resourceParser?: ResourceParser, htmlCompiler?: HtmlCompiler) {
        // internal
        this.cache = new PipelineCache();

        // required
        this.pipelineInterface = pipelineInterface;

        // overribable
        this.htmlFormatter = htmlFormatter ?? new StandardHtmlFormatter();
        this.resourceParser = resourceParser ?? new ResourceParser(this);
        this.htmlCompiler = htmlCompiler ?? new HtmlCompiler();
    }

    /**
     * Compiles a page from start to finish.
     * This is the only entry point that should be called by user code.
     * 
     * @param resPath Path to the page, relative to both source and destination.
     * @returns a CompiledPage containing the Page instance and serialized / formatted HTML
     */
    compilePage(resPath: string): Page {
        // compile fragment
        const pageFragment: Fragment = this.compileFragment(resPath);
        const pageDom: DocumentNode = pageFragment.dom;

        // compile as page
        buildPage(pageDom);

        // format page
        this.htmlFormatter.formatDom(pageDom);

        // serialize to html
        const rawHtml: string = pageDom.toHtml();

        // format html
        const formattedHtml: string = this.htmlFormatter.formatHtml(rawHtml);

        // write HTML
        this.pipelineInterface.writeResource(ResourceType.HTML, resPath, formattedHtml);

        // create and return page
        return {
            path: resPath,
            dom: pageDom,
            html: formattedHtml
        };
    }

    /**
     * Compiles a fragment.
     * 
     * @param resPath Path to fragment source
     * @param fragmentContext Current usage context, if applicable
     * @returns Fragment instance
     */
    compileFragment(resPath: string, fragmentContext?: FragmentContext): Fragment {
        // get fragment from cache or htmlSource
        const fragment: Fragment = this.getOrParseFragment(resPath);

        // create usage context if not provided
        if (fragmentContext == undefined) {
            fragmentContext = {
                slotContents: new Map(),
                parameters: new Map(),
                scope: {}
            };
        }

        // create module context
        const pipelineContext: PipelineContext = {
            pipeline: this,
            fragment: fragment,
            fragmentContext: fragmentContext
        };

        // compile under current context
        this.htmlCompiler.compileHtml(fragment, pipelineContext);

        return fragment;
    }

    /**
     * Compiles a component.
     * 
     * @param resPath Path to component source
     * @param usageContext Current usage context
     * @returns Fragment instance
     */
    compileComponent(resPath: string, fragmentContext: FragmentContext): Fragment {
        // get or parse component
        const component: Component = this.getOrParseComponent(resPath);

        // create fragment
        const fragDom: DocumentNode = component.template.dom;
        const fragResPath = component.template.srcResPath ?? resPath;
        const fragment: Fragment = {
            path: fragResPath,
            dom: fragDom
        };

        // create module context for outer (component file) scope
        const fragmentPipelineContext: PipelineContext = {
            pipeline: this,
            fragment: fragment,
            fragmentContext: fragmentContext
        };

        // create component script instance
        const componentInstanceEvalContext = new EvalContext(fragmentPipelineContext, fragmentContext.scope);
        const componentInstance: ScopeData = component.script.scriptFunction.invoke(componentInstanceEvalContext);

        // add component script data to context
        const componentPipelineContext: PipelineContext = {
            pipeline: this,
            fragment: fragment,
            fragmentContext: {
                slotContents: fragmentContext.slotContents,
                parameters: fragmentContext.parameters,
                scope: createFragmentScope(fragmentContext.parameters, componentInstance)
            }
        };

        // compile HTML
        this.htmlCompiler.compileHtml(fragment, componentPipelineContext);

        // compile styles
        if (component.style != undefined) {
            // compile CSS
            const compiledStyle = this.compileCss(component.style.styleContent);

            // bind to page
            bindStyle(component.resPath, compiledStyle, component.style.bindType, componentPipelineContext);
        }

        return fragment;
    }

    /**
     * Compiles a JS expression
     * Embedded scripts will be evaluated in the current context.
     * Plain text will be returned as-is.
     * 
     * @param value Text value
     * @param evalContext Current compilation context
     * @returns compiled value of the input value
     */
    compileExpression(value: string, evalContext: EvalContext): unknown {
        // check if this text contains JS code to evaluate
        if (isExpressionString(value)) {
            const expression = value.trim();
    
            // get function for script
            const expressionFunc = this.getOrParseExpression(expression);
            
            // execute it
            return expressionFunc.invoke(evalContext);
        }

        // value is plain string
        return value;
    }

    /**
     * Compiles and executes javascript.
     * The script can be multiple lines, and use any JS feature that is available within a function body.
     * Script will execute with the provided eval context.
     * 
     * @param script Javascript code
     * @param evalContext Context to execute in
     * @returns The return value of the script, if any.
     */
    compileScript(script: string, evalContext: EvalContext): unknown {
        const scriptText = script.trim();

        // get function for script
        const scriptFunc = this.getOrParseScript(scriptText);
        
        // execute it
        return scriptFunc.invoke(evalContext);
    }


    /**
     * Compiles and executes javascript from an external file.
     * The script can be multiple lines, and use any JS feature that is available within a function body.
     * Script will execute with the provided eval context.
     * 
     * @param resPath Path to script file
     * @param evalContext Context to execute in
     * @returns The return value of the script, if any.
     */
    compileExternalScript(resPath: string, evalContext: EvalContext): unknown {
        // get function for script
        const script: string = this.getOrParseExternalScript(resPath);
        
        // execute it
        return this.compileScript(script, evalContext);
    }

    /**
     * Compiles CSS. Currently a no-op.
     * 
     * @param css CSS text
     * @returns Compile CSS text
     */
    compileCss(css: string): string {
        return css;
    }

    /**
     * Links a created resource to the compilation output.
     * This method ONLY handles saving the contents, it does not compile them or attach them to the actual HTML.
     * This method is ONLY for created (incidental) resources.
     * 
     * @param type Type of resource
     * @param contents Contents as a UTF-8 string
     * @param sourceResPath Path to the explicit resource that has produced this created resource
     * @returns path to reference linked resource
     */
    linkResource(type: ResourceType, contents: string, sourceResPath: string): string {
        // hash contents
        const contentsHash = this.fastHashContent(contents);

        // get from cache, if present
        if (this.cache.hasCreatedResource(contentsHash)) {
            // get cached path
            const originalResPath = this.cache.getCreatedResource(contentsHash);

            // allow PI to relink in case type and/or sourceResPath are different, and that matters.
            // default PI implementation does not include this method so nothing will happen
            if (this.pipelineInterface.reLinkCreatedResource != undefined) {
                return this.pipelineInterface.reLinkCreatedResource(type, contents, sourceResPath, originalResPath);
            } else {
                // if PI does not implement relinking, then we can safely reuse the old path
                return originalResPath;
            }
        }
        
        // if not in cache, then call PI to create resource
        const resPath = this.pipelineInterface.createResource(type, contents, sourceResPath);

        // store in cache
        this.cache.storeCreatedResource(contentsHash, resPath);

        return resPath;
    }

    /**
     * Gets a raw (parsed but uncompiled) fragment.
     * 
     * @internal
     * @param resPath Path to fragment
     * @returns Uncompiled fragment
     */
    getRawFragment(resPath: string): Fragment {
        return this.getOrParseFragment(resPath);
    }

    /**
     * Resets the pipeline to its initial state.
     */
    reset(): void {
        // clear cache to reset state
        this.cache.clear();
    }

    /**
     * Create a NON-CRYPTOGRAPHIC (INSECURE) hash of some pipeline content.
     * Hash algorithm should be strong enough to use for caching, but does not need to be cryptographically secure.
     * This may be called many times by the pipeline, so the algorithm used should be reasonably fast as well.
     * 
     * Standard implementation uses MD5 as provided by the Node.JS Crypto module.
     * Override to change implementation
     * 
     * @param content Content to hash. Should be a UTF-8 string.
     * @returns Returns a hash of content as a Base64 string
     */
    protected fastHashContent(content: string): string {
        // create hash instance
        const md5 = crypto.createHash('md5');
        
        // load the content
        md5.update(content, 'utf8');

        // calculate the hash
        return md5.digest('base64');
    }

    private getOrParseFragment(resPath: string): Fragment {
        let fragment: Fragment;

        if (this.cache.hasFragment(resPath)) {
            // use cached fragment
            fragment = this.cache.getFragment(resPath);
        } else {
            // read HTML
            const html: string = this.pipelineInterface.getResource(ResourceType.HTML, resPath);

            // parse fragment
            const parsedFragment: Fragment = this.resourceParser.parseFragment(resPath, html);

            // keep in cache
            this.cache.storeFragment(parsedFragment);

            fragment = parsedFragment;
        }

        // return a clone
        return {
            path: fragment.path,
            dom: fragment.dom.clone()
        };
    }

    private getOrParseComponent(resPath: string): Component {
        let component: Component;

        if (this.cache.hasComponent(resPath)) {
            // use cached component
            component = this.cache.getComponent(resPath);
        } else {
            // read HTML
            const html: string = this.pipelineInterface.getResource(ResourceType.HTML, resPath);

            // parse component
            const parsedComponent: Component = this.resourceParser.parseComponent(resPath, html);

            // keep in cache
            this.cache.storeComponent(parsedComponent);

            component = parsedComponent;
        }

        return component.clone();
    }

    private getOrParseExpression(expression: string): EvalContent<unknown> {
        let expressionFunc: EvalContent<unknown>;

        // get from cache, if present
        if (this.cache.hasExpression(expression)) {
            expressionFunc = this.cache.getExpression(expression);
        } else {
            // compile text
            expressionFunc = parseExpression(expression);

            // store in cache
            this.cache.storeExpression(expression, expressionFunc);
        }

        return expressionFunc;
    }

    private getOrParseScript(script: string): EvalContent<unknown> {
        let scriptFunc: EvalContent<unknown>;

        // get from cache, if present
        if (this.cache.hasScript(script)) {
            scriptFunc = this.cache.getScript(script);
        } else {
            // compile script
            scriptFunc = parseScript(script);

            // store in cache
            this.cache.storeScript(script, scriptFunc);
        }

        return scriptFunc;
    }

    private getOrParseExternalScript(resPath: string): string {
        let script: string;

        // get from cache, if present
        if (this.cache.hasExternalScript(resPath)) {
            script = this.cache.getExternalScript(resPath);
        } else {
            // load resource
            const scriptResource = this.pipelineInterface.getResource(ResourceType.JAVASCRIPT, resPath);

            // store in cache
            script = scriptResource.trim();
            this.cache.storeExternalScript(resPath, script);
        }

        return script;
    }
}

/**
 * Calculates the MD5 hash of a UTF8 string using Node.JS crypto APIs.
 * MD5 is an INSECURE hash so this should ONLY be used for non-security-sensitive tasks like caching.
 * 
 * @param content Content to hash. Should be a UTF-8 string.
 * @returns Returns a hash of content as a Base64 string
 */
export function hashMD5(content: string): string {
    // create hash instance
    const md5 = crypto.createHash('md5');
    
    // load the content
    md5.update(content, 'utf8');

    // calculate the hash
    return md5.digest('base64');
}

// TODO docs
export interface PipelineContext {
    /**
     * Current pipeline instance
     */
    readonly pipeline: StandardPipeline;

    /**
     * Current fragment that is being compiled
     */
    readonly fragment: Fragment;

    readonly fragmentContext: FragmentContext;
}