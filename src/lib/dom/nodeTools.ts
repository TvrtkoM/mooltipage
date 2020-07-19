import { Node, NodeWithChildren, DocumentNode, TagNode, TextNode, CommentNode, CDATANode, ProcessingInstructionNode, MFragmentNode, MComponentNode, MSlotNode, MContentNode, MVarNode, MImportNode } from "..";

/**
 * Detatch a node and its children from the DOM.
 * @param node Node to detatch
 */
export function detatchNode(node: Node): void {
    if (node.parentNode != null) {
        node.parentNode.childNodes = node.parentNode.childNodes.filter((childNode: Node) => childNode !== node);
    }

    if (node.prevSibling != null) {
        node.prevSibling.nextSibling = node.nextSibling;
    }

    if (node.nextSibling != null) {
        node.nextSibling.prevSibling = node.prevSibling;
    }

    node.prevSibling = null;
    node.nextSibling = null;
    node.parentNode = null;
}

/**
 * Check if one node is the child of another
 * @param parent Parent node
 * @param child Possible child node
 */
export function hasChild(parent: NodeWithChildren, child: Node): boolean {
    return parent.childNodes.includes(child);
}

/**
 * Appends one node to another as a child.
 * Node will be inserted at the end of the parent's child nodes list.
 * 
 * @param parent Parent node
 * @param child New child node
 */
export function appendChild(parent: NodeWithChildren, child: Node): void {
    detatchNode(child);

    if (parent.lastChild) {
        parent.lastChild.nextSibling = child;
        child.prevSibling = parent.lastChild;
    }

    parent.childNodes.push(child);
    child.parentNode = parent;
}

/**
 * Appends one node to another as a child.
 * Node will be inserted at the start of the parent's child nodes list.
 * 
 * @param parent Parent node
 * @param child New child node
 */
export function prependChild(parent: NodeWithChildren, child: Node): void {
    detatchNode(child);

    if (parent.firstChild) {
        parent.firstChild.prevSibling = child;
        child.nextSibling = parent.firstChild;
    }

    parent.childNodes.splice(0, 0, child);
    child.parentNode = parent;
}

/**
 * Removes all children from a node
 * @param parent Parent to remove nodes from
 */
export function clear(parent: NodeWithChildren): void {
    for (const child of Array.from(parent.childNodes)) {
        detatchNode(child);
    }
}

/**
 * Appends a list of nodes to a parent
 * @param parent Parent node
 * @param childNodes New child nodes
 */
export function appendChildNodes(parent: NodeWithChildren, childNodes: Node[]): void {
    for (const childNode of childNodes) {
        appendChild(parent, childNode);
    }
}

/**
 * Places a node immediately after another as a sibling.
 * @param node Node to insert
 * @param after Existing node
 * @throws Throws if after is a DocumentNode
 */
export function appendSibling(node: Node, after: Node): void {
    if (DocumentNode.isDocumentNode(after)) {
        throw new Error(`Attempting to append ${node.nodeType} after DocumentNode`);
    }

    detatchNode(node);

    const parent = after.parentNode;

    if (parent != null) {
        node.parentNode = parent;

        const afterIndex = parent.childNodes.indexOf(after);
        parent.childNodes.splice(afterIndex + 1, 0, node);
    }

    if (after.nextSibling != null) {
        node.nextSibling = after.nextSibling;
        after.nextSibling.prevSibling = node;
    }

    after.nextSibling = node;
    node.prevSibling = after;
}

/**
 * Places a node immediately before another as a sibling.
 * @param node Node to insert
 * @param after Existing node
 * @throws Throws if after is a DocumentNode
 */
export function prependSibling(node: Node, before: Node): void {
    if (DocumentNode.isDocumentNode(before)) {
        throw new Error(`Attempting to prepend ${node.nodeType} before DocumentNode`);
    }

    detatchNode(node);
    
    const parent = before.parentNode;

    if (parent != null) {
        node.parentNode = parent;

        const beforeIndex = parent.childNodes.indexOf(before);
        parent.childNodes.splice(beforeIndex, 0, node);
    }

    if (before.prevSibling != null) {
        node.prevSibling = before.prevSibling;
        before.prevSibling.nextSibling = node;
    }

    before.prevSibling = node;
    node.nextSibling = before;
}

/**
 * Gets the first child from a list of nodes
 * @param nodes Return the first node from a list, or null if the list is empty
 */
export function getFirstNode(nodes: Node[]): Node | null {
    if (nodes.length > 0) {
        return nodes[0];
    } else {
        return null;
    }
}

/**
 * Gets the last child from a list of nodes
 * @param nodes Return the last node from a list, or null if the list is empty
 */
export function getLastNode(nodes: Node[]): Node | null {
    if (nodes.length > 0) {
        return nodes[nodes.length - 1];
    } else {
        return null;
    }
}

// not exported
function processClonedNode<T extends Node>(oldNode: T, newNode: T, callback?: (oldNode: Node, newNode: Node) => void): void {
    if (callback != undefined) {
        callback(oldNode, newNode);
    }
}

// not exported
function processClonedParentNode<T extends NodeWithChildren>(oldNode: T, newNode: T, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): void {
    processClonedNode(oldNode, newNode, callback);

    if (deep) {
        cloneChildNodes(newNode, oldNode.childNodes, callback);
    }
}

// not exported
function cloneAttributes(node: TagNode): Map<string, string | null> {
    const oldAttrs = node.getAttributes();

    const attrEntries = oldAttrs.entries();

    return new Map(attrEntries);
}

/**
 * Clones a tag node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneTagNode(node: TagNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): TagNode {
    const newAttrs = cloneAttributes(node);

    const newNode: TagNode = new TagNode(node.tagName, newAttrs);

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones a text node
 * @param node Node to clone
 * @param callback Optional callback after node is cloned
 */
export function cloneTextNode(node: TextNode, callback?: (oldNode: Node, newNode: Node) => void): TextNode {
    const newNode: TextNode = new TextNode(node.text);
    
    processClonedNode(node, newNode, callback);

    return newNode;
}

/**
 * Clones a comment node
 * @param node Node to clone
 * @param callback Optional callback after node is cloned
 */
export function cloneCommentNode(node: CommentNode, callback?: (oldNode: Node, newNode: Node) => void): CommentNode {
    const newNode: CommentNode = new CommentNode(node.text);
    
    processClonedNode(node, newNode, callback);

    return newNode;
}

/**
 * Clones a CDATA node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneCDATANode(node: CDATANode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): CDATANode {
    const newNode: CDATANode = new CDATANode();

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones a processing instruction node
 * @param node Node to clone
 * @param callback Optional callback after node is cloned
 */
export function cloneProcessingInstructionNode(node: ProcessingInstructionNode, callback?: (oldNode: Node, newNode: Node) => void): ProcessingInstructionNode {
    const newNode: ProcessingInstructionNode = new ProcessingInstructionNode(node.name, node.data);
    
    processClonedNode(node, newNode, callback);

    return newNode;
}

/**
 * Clones a document node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneDocumentNode(node: DocumentNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): DocumentNode {
    const newNode: DocumentNode = new DocumentNode();

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones an m-fragment node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneMFragmentNode(node: MFragmentNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): MFragmentNode {
    const newAttrs = cloneAttributes(node);

    const newNode: MFragmentNode = new MFragmentNode(node.src, newAttrs);

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones an m-component node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneMComponentNode(node: MComponentNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): MComponentNode {
    const newAttrs = cloneAttributes(node);

    const newNode: MComponentNode = new MComponentNode(node.src, newAttrs);

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones an m-slot node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneMSlotNode(node: MSlotNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): MSlotNode {
    const newAttrs = cloneAttributes(node);

    const newNode: MSlotNode = new MSlotNode(node.slot, newAttrs);

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones an m-content node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneMContentNode(node: MContentNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): MContentNode {
    const newAttrs = cloneAttributes(node);

    const newNode: MContentNode = new MContentNode(node.slot, newAttrs);

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones an m-var node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneMVarNode(node: MVarNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): MVarNode {
    const newAttrs = cloneAttributes(node);

    const newNode: MVarNode = new MVarNode(newAttrs);

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Clones an m-import node
 * @param node Node to clone
 * @param deep If true, children will be cloned
 * @param callback Optional callback after node is cloned
 */
export function cloneMImportNode(node: MImportNode, deep: boolean, callback?: (oldNode: Node, newNode: Node) => void): MImportNode {
    const newAttrs = cloneAttributes(node);

    const newNode = new MImportNode(node.src, node.as, node.fragment, node.component, newAttrs);

    processClonedParentNode(node, newNode, deep, callback);

    return newNode;
}

/**
 * Finds the first child node that matches a matcher
 * @param parent Parent node
 * @param matcher Matcher to check nodes
 * @param deep If true, child nodes will be recursively searched
 */
export function findChildNode(parent: NodeWithChildren, matcher: (node: Node) => boolean, deep: boolean): Node | null {
    for (const childNode of parent.childNodes) {
        if (matcher(childNode)) {
            return childNode;
        }

        if (deep && NodeWithChildren.isNodeWithChildren(childNode)) {
            const childMatch = findChildNode(childNode, matcher, true);
            if (childMatch != null) {
                return childMatch;
            }
        }
    }

    return null;
}

/**
 * Finds all child nodes that match a matcher
 * @param parent Parent node
 * @param matcher Matcher to check nodes
 * @param deep If true, child nodes will be recursively searched
 * @param matches Existing list of nodes to append to, if desired
 */
export function findChildNodes(parent: NodeWithChildren, matcher: (node: Node) => boolean, deep: boolean, matches: Node[] = []): Node[] {
    for (const childNode of parent.childNodes) {
        if (matcher(childNode)) {
            matches.push(childNode);
        }

        if (deep && NodeWithChildren.isNodeWithChildren(childNode)) {
            findChildNodes(childNode, matcher, true, matches);
        }
    }

    return matches;
}

/**
 * Finds the first child tag that matches a matcher
 * @param parent Parent node
 * @param matcher Matcher to check tags
 * @param deep If true, child tags will be recursively searched
 */
export function findChildTag(parent: NodeWithChildren, matcher: (tag: TagNode) => boolean, deep: boolean): TagNode | null {
    const newMatcher = (node: Node) => TagNode.isTagNode(node) && matcher(node);
    return findChildNode(parent, newMatcher, deep) as TagNode;
}

/**
 * Finds all child tags that match a matcher
 * @param parent Parent node
 * @param matcher Matcher to check tags
 * @param deep If true, child tags will be recursively searched
 * @param matches Existing list of tags to append to, if desired
 */
export function findChildTags(parent: NodeWithChildren, matcher: (tag: TagNode) => boolean, deep: boolean): TagNode[] {
    const newMatcher = (node: Node) => TagNode.isTagNode(node) && matcher(node);
    return findChildNodes(parent, newMatcher, deep) as TagNode[];
}

/**
 * Replace a node in the DOM with one or more replacements.
 * Child nodes will be deleted.
 * 
 * @param remove Node to remove
 * @param replacements Replacement nodes
 */
export function replaceNode(remove: Node, replacements: Node[]): void {
    let prevNode: Node = remove;

    for (const newNode of replacements) {
        prevNode.appendSibling(newNode);
        prevNode = newNode;
    }

    detatchNode(remove);
}

/**
 * Swaps a node in the DOM for another.
 * The first node's children will be attached to the replacment.
 * The replacement's children will be preserved.
 * 
 * @param remove Node to remove
 * @param replacement Node to replace with
 */
export function swapNode(remove: NodeWithChildren, replacement: NodeWithChildren): void {
    replacement.appendChildren(remove.childNodes);

    remove.replaceSelf(replacement);
}

/**
 * Gets all child tags from a parent node
 * @param parent Parent node
 */
export function getChildTags(parent: NodeWithChildren): TagNode[] {
    return parent.childNodes.filter((node: Node) => TagNode.isTagNode(node)) as TagNode[];
}

/**
 * Walk through the DOM using a depth-first recursion, and call a callback for each node
 * @param node Node to start with
 * @param callback Callback to call
 */
export function walkDom(node: Node, callback: (node: Node) => void): void {
    callback(node);

    if (NodeWithChildren.isNodeWithChildren(node)) {
        for (const childNode of node.childNodes) {
            walkDom(childNode, callback);
        }
    }
}

/**
 * Finds all child tags that match a series of matchers.
 * Each matcher will be used in sequence, and children of all matching tags will be passed to the next matcher.
 * When the end of the list is reached, all matching nodes are returned.
 * 
 * @param root Parent node
 * @param matchers List of matchers
 */
export function findChildTagsByPath(root: NodeWithChildren, matchers: ((tag: TagNode) => boolean)[]): TagNode[] {
    return findChildTagsByPathAt(root, matchers, 0, []);
}

// not exported
function findChildTagsByPathAt(root: NodeWithChildren, matchers: ((tag: TagNode) => boolean)[], offset: number, matches: TagNode[]): TagNode[] {
    if (offset < matchers.length) {
        const matcher = matchers[offset];

        for (const childNode of root.childNodes) {
            // check if this node matches
            if (TagNode.isTagNode(childNode) && matcher(childNode)) {
                if (offset === matchers.length - 1) {
                    // if we are at the last matcher, then this is a result
                    matches.push(childNode);
                } else {
                    // if not at the last matcher, then recurse for child nodes
                    findChildTagsByPathAt(childNode, matchers, offset + 1, matches);
                }
            }
        }
    }

    return matches;
}

/**
 * Finds all tag tags that match a matcher, that are not children of another matching node.
 * Basically, this is findChildTags but recursion stops when a match is found.
 * 
 * @param parent Parent tag
 * @param matcher Matcher to check tags
 * @param matches Existing list of tags to append to, if desired
 */
export function findTopLevelChildTags(parent: NodeWithChildren, matcher: (tag: TagNode) => boolean, matches: TagNode[] = []): TagNode[] {
    for (const childNode of parent.childNodes) {
        if (TagNode.isTagNode(childNode) && matcher(childNode)) {
            matches.push(childNode);
        } else if (NodeWithChildren.isNodeWithChildren(childNode)) {
            findTopLevelChildTags(childNode, matcher, matches);
        }
    }

    return matches;
}

/**
 * Removes all children from a parent node and creates a DocumentNode containing them
 * 
 * @param parent Parent node
 */
export function createDomFromChildren(parent: NodeWithChildren): DocumentNode {
    // create dom
    const dom: DocumentNode = new DocumentNode();

    // transfer children
    dom.appendChildren(parent.childNodes);

    return dom;
}

// not exported
function cloneChildNodes(parent: NodeWithChildren, childNodes: Node[], callback?: (oldNode: Node, newNode: Node) => void): void {
    if (childNodes.length > 0) {
        const newChildren = childNodes.map(node => node.clone(true, callback));
        appendChildNodes(parent, newChildren);
    }
}
