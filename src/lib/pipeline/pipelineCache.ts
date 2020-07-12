import { Fragment } from './object/fragment';
import { EvalContent } from './evalEngine';
import { Page } from './object/page';
import { Component } from './object/component';

export class PipelineCache {
    private readonly pageCache: Map<string, Page>;
    private readonly fragmentCache: Map<string, Fragment>;
    private readonly componentCache: Map<string, Component>;
    private readonly scriptTextCache: Map<string, EvalContent<unknown>>;

    constructor() {
        this.pageCache = new Map();
        this.fragmentCache = new Map();
        this.componentCache = new Map();
        this.scriptTextCache = new Map();
    }

    // Page

    hasPage(resId: string): boolean {
        return this.pageCache.has(resId);
    }

    getPage(resId: string): Page {
        const page: Page | undefined = this.pageCache.get(resId);

        if (page == undefined) {
            throw new Error(`Page not found in cache: ${resId}.  Make sure to call hasPage() before getPage().`);
        }

        return page;
    }

    storePage(page: Page): void {
        this.pageCache.set(page.resId, page);
    }

    // Fragment

    hasFragment(resId: string): boolean {
        return this.fragmentCache.has(resId);
    }

    getFragment(resId: string): Fragment {
        const fragment: Fragment | undefined = this.fragmentCache.get(resId);

        if (fragment == undefined) {
            throw new Error(`Fragment not found in cache: ${resId}.  Make sure to call hasFragment() before getFragment().`);
        }

        return fragment;
    }

    storeFragment(fragment: Fragment): void {
        this.fragmentCache.set(fragment.resId, fragment);
    }

    // Component

    hasComponent(resId: string): boolean {
        return this.componentCache.has(resId);
    }

    getComponent(resId: string): Component {
        const component: Component | undefined = this.componentCache.get(resId);

        if (component == undefined) {
            throw new Error(`Component not found in cache: ${resId}.  Make sure to call hasComponent() before getComponent().`);
        }

        return component;
    }

    storeComponent(component: Component): void {
        this.componentCache.set(component.resId, component);
    }

    // Script text

    hasScriptText(signature: string): boolean {
        return this.scriptTextCache.has(signature);
    }

    getScriptText(signature: string): EvalContent<unknown> {
        const templateFunc: EvalContent<unknown> | undefined = this.scriptTextCache.get(signature);

        if (templateFunc == undefined) {
            throw new Error(`Script text function not found in cache: ${signature}.  Make sure to call hasScriptText() before getScriptText().`);
        }

        return templateFunc;
    }

    storeScriptText(signature: string, templateFunc: EvalContent<unknown>): void {
        this.scriptTextCache.set(signature, templateFunc);
    }

    // general

    clear(): void {
        this.pageCache.clear();
        this.fragmentCache.clear();
        this.componentCache.clear();
        this.scriptTextCache.clear();
    }
}