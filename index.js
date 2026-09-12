import { chat as tavernChat, chatElement as tavernChatElement, event_types, eventSource, getMediaDisplay, getMediaIndex, refreshSwipeButtons, updateEditArrowClasses, updateMessageElement } from '/script.js';
import { applyStylePins } from '/scripts/power-user.js';
import { applyCharacterTagsToMessageDivs } from '/scripts/tags.js';

(function () {
    'use strict';

    const extensionId = 'shiyu-html-exporter';
    const settingsId = `${extensionId}-settings`;
    const selectModeClass = `${extensionId}-select-mode`;
    const checkboxClass = `${extensionId}-message-checkbox`;
    const selectedClass = `${extensionId}-selected-outline`;
    const unnamedChapterTitle = '\u65e0\u540d\u4e4b\u7ae0';
    const batchSize = 20;
    const assetFetchConcurrency = 6;
    const embeddedAssetDedupeThreshold = 1024;
    const embeddedAssetMarkerPrefix = 'data:application/x-html-export-asset,';
    const embeddedAssetMarkerSuffix = ';';
    const fetchTimeoutMs = 30000;
    const frontendRenderTimeoutMs = 15000;
    const searchContextChars = 50;
    const searchResultLimit = 200;
    const imageCompressionPresets = Object.freeze({
        none: null,
        conservative: {
            label: '\u4fdd\u5b88',
            maxEdge: 1600,
            quality: 0.86,
        },
        balanced: {
            label: '\u6027\u4ef7\u6bd4',
            maxEdge: 1024,
            quality: 0.82,
        },
        compact: {
            label: '\u5c0f\u4f53\u79ef',
            maxEdge: 960,
            quality: 0.78,
        },
    });
    const backgroundStyleProperties = [
        'background-image',
        'background-color',
        'background-size',
        'background-position',
        'background-repeat',
        'background-attachment',
        'background-origin',
        'background-clip',
        'background-blend-mode',
        'opacity',
        'filter',
    ];
    const tavernThemeVariableNames = [
        '--SmartThemeBodyColor',
        '--SmartThemeEmColor',
        '--SmartThemeUnderlineColor',
        '--SmartThemeQuoteColor',
        '--SmartThemeBlurTintColor',
        '--SmartThemeChatTintColor',
        '--SmartThemeUserMesBlurTintColor',
        '--SmartThemeBotMesBlurTintColor',
        '--SmartThemeBlurStrength',
        '--SmartThemeShadowColor',
        '--SmartThemeBorderColor',
        '--SmartThemeCheckboxBgColorR',
        '--SmartThemeCheckboxBgColorG',
        '--SmartThemeCheckboxBgColorB',
        '--SmartThemeCheckboxBgColorA',
        '--SmartThemeCheckboxTickColorValue',
        '--SmartThemeCheckboxTickColor',
        '--sheldWidth',
    ];
    const computedStyleProperties = [
        'align-items',
        'background',
        'background-blend-mode',
        'background-clip',
        'background-color',
        'background-image',
        'background-origin',
        'background-position',
        'background-repeat',
        'background-size',
        'border',
        'border-radius',
        'box-shadow',
        'box-sizing',
        'color',
        'display',
        'filter',
        'flex',
        'flex-basis',
        'flex-direction',
        'flex-grow',
        'flex-shrink',
        'flex-wrap',
        'font-family',
        'font-size',
        'font-style',
        'font-weight',
        'gap',
        'justify-content',
        'letter-spacing',
        'line-height',
        'list-style',
        'margin-bottom',
        'margin-top',
        'max-height',
        'max-width',
        'min-height',
        'min-width',
        'object-fit',
        'object-position',
        'opacity',
        'overflow-wrap',
        'padding',
        'text-align',
        'text-decoration',
        'text-shadow',
        'text-transform',
        'vertical-align',
        'white-space',
        'writing-mode',
        'word-break',
    ];
    const scrollBoxStyleProperties = [
        'height',
        'max-height',
        'overflow',
        'overflow-x',
        'overflow-y',
        'overscroll-behavior',
        'width',
    ];
    let activeTemporaryRender = null;
    let activeExportTask = null;
    let activeRenderTask = null;

    const controlSelectors = [
        `.${checkboxClass}`,
        '.mes_buttons',
        '.mes_edit_buttons',
        '.mes_edit_cancel',
        '.mes_edit_done',
        '.mes_edit_delete',
        '.mes_edit_copy',
        '.swipe_left',
        '.swipe_right',
        '.swipe_counter',
        '.favorite-toggle-icon',
        '.del_checkbox',
        '.extraMesButtons',
    ];

    function init() {
        if (document.getElementById(settingsId)) {
            return;
        }

        const container = document.querySelector('#extensions_settings2')
            || document.querySelector('#extensions_settings')
            || document.querySelector('.extensions_settings');

        if (!container) {
            setTimeout(init, 500);
            return;
        }

        container.insertAdjacentHTML('beforeend', `
            <div class="extension-settings" id="${settingsId}">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>\u62fe\u7389-HTML\u5bfc\u51fa</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="html-exporter-options">
                            <label class="checkbox_label">
                                <input id="${extensionId}-embed-assets" type="checkbox" checked>
                                <span>&#20869;&#23884;&#32842;&#22825;&#20869;&#22270;&#29255;&#12289;&#22836;&#20687;&#12289;&#29983;&#22270;</span>
                            </label>
                            <div class="html-exporter-field">
                                <label for="${extensionId}-image-compression">&#20869;&#23884;&#22270;&#29255;&#21387;&#32553;</label>
                                <select id="${extensionId}-image-compression" class="text_pole html-exporter-select">
                                    <option value="none">&#19981;&#21387;&#32553;&#65288;&#21482;&#26080;&#25439;&#21435;&#37325;&#65289;</option>
                                    <option value="conservative">&#20445;&#23432;&#65306;&#21407;&#23610;&#23544; WebP 0.86</option>
                                    <option value="balanced">&#24615;&#20215;&#27604;&#65306;&#26368;&#38271;&#36793; 1024 WebP 0.82</option>
                                    <option value="compact">&#23567;&#20307;&#31215;&#65306;&#26368;&#38271;&#36793; 960 WebP 0.78</option>
                                </select>
                                <small class="notes">&#36866;&#21512;&#37202;&#39302;&#24120;&#35265; 1216x832 &#29983;&#22270;&#65307;&#21482;&#26367;&#25442;&#21387;&#23436;&#26356;&#23567;&#30340;&#22270;&#12290;</small>
                            </div>
                            <label class="checkbox_label">
                                <input id="${extensionId}-preserve-theme" type="checkbox" checked>
                                <span>&#20445;&#30041;&#24403;&#21069;&#20027;&#39064;&#39068;&#33394;&#12289;&#25991;&#26412;&#32972;&#26223;&#12289;&#23383;&#20307;</span>
                            </label>
                            <label class="checkbox_label">
                                <input id="${extensionId}-preserve-message-chrome" type="checkbox">
                                <span>&#20445;&#30041;&#35268;&#33539;&#21270;&#22836;&#37096;&#20449;&#24687;&#65288;&#22836;&#20687;&#12289;&#20316;&#32773;&#12289;&#26102;&#38388;&#12289;&#23383;&#25968;&#65289;</span>
                            </label>
                            <label class="checkbox_label">
                                <input id="${extensionId}-indent-paragraphs" type="checkbox">
                                <span>&#27573;&#33853;&#39318;&#34892;&#31354;&#20004;&#26684;&#65288;&#32473;&#27491;&#25991; &lt;p&gt; &#21152; 2em &#32553;&#36827;&#65289;</span>
                            </label>
                            <label class="checkbox_label">
                                <input id="${extensionId}-inline-style-assets" type="checkbox">
                                <span>&#22797;&#21046;&#23436;&#25972;&#39029;&#38754; CSS&#65288;&#29992;&#20110;&#37202;&#39302;&#21161;&#25163;&#21644;&#20027;&#39064;&#32654;&#21270;&#65289;</span>
                            </label>
                            <label class="checkbox_label">
                                <input id="${extensionId}-preserve-background" type="checkbox" checked>
                                <span>&#20445;&#30041;&#37202;&#39302;&#35270;&#35273;&#32972;&#26223;&#65288;&#21482;&#23548;&#20986;&#32972;&#26223;&#23618;&#65289;</span>
                            </label>
                            <label class="checkbox_label">
                                <input id="${extensionId}-include-outside-status" type="checkbox" checked>
                                <span>&#23548;&#20986;&#27491;&#25991;&#22806;&#20391;&#29366;&#24577;&#26639;&#21644;&#22806;&#32622;&#32654;&#21270;&#22359;</span>
                            </label>
                            <div class="html-exporter-field">
                                <label for="${extensionId}-render-range-input">&#20020;&#26102;&#28210;&#26579;&#27004;&#23618;&#33539;&#22260;</label>
                                <input id="${extensionId}-render-range-input" class="text_pole" type="text" spellcheck="false" placeholder="300 &#25110; 300-399">
                                <small class="notes">\u652f\u6301\uff1a<code>300</code> \u6216 <code>300-399</code>\u3002\u70b9\u201c\u6e32\u67d3\u9009\u5b9a\u8303\u56f4\u5230\u9875\u9762\u201d\u540e\uff0c\u5185\u5bb9\u4f1a\u771f\u5b9e\u663e\u793a\u5728\u804a\u5929\u533a\uff1b\u786e\u8ba4\u6b63\u5e38\u540e\u70b9\u201c\u5bfc\u51fa\u5f53\u524d\u6e32\u67d3\u697c\u5c42\u201d\u3002</small>
                            </div>
                            <label for="${extensionId}-favorites">&#25910;&#34255;&#27004;&#23618;</label>
                            <textarea id="${extensionId}-favorites" class="text_pole html-exporter-textarea" rows="4" spellcheck="false" placeholder="94 | &#26631;&#31614; | &#36825;&#37324;&#20889;&#22791;&#27880;&#10;12,18,35 | &#22791;&#27880;"></textarea>
                            <small class="notes">\u4e00\u884c\u4e00\u6761\uff1a<code>94 | \u6807\u7b7e | \u5907\u6ce8</code>\u3002<code>12,18,35 | \u6807\u7b7e | \u5907\u6ce8</code>\u4f1a\u7ed9\u591a\u697c\u8bbe\u7f6e\u540c\u4e00\u6807\u7b7e\u548c\u5907\u6ce8\uff1b\u4e0d\u586b\u6807\u7b7e\u53ef\u5199 <code>12,18,35 | \u5907\u6ce8</code>\u3002\u5bfc\u51fa\u540e\u4ecd\u53ef\u5904\u7406\u3002</small>
                            <label for="${extensionId}-chapters">&#30446;&#24405;&#31456;&#33410;</label>
                            <textarea id="${extensionId}-chapters" class="text_pole html-exporter-textarea" rows="4" spellcheck="false" placeholder="20-50 | XXX&#10;80-90 | YYY"></textarea>
                            <small class="notes">\u4e00\u884c\u4e00\u7ae0\uff1a<code>20-50 | \u7ae0\u8282\u540d</code>\u3002\u672a\u5f52\u7c7b\u697c\u5c42\u4f1a\u81ea\u52a8\u52a0\u5165\u65e0\u540d\u4e4b\u7ae0\u3002\u5bfc\u51fa\u540e\u4ecd\u53ef\u5904\u7406\u3002</small>
                        </div>
                        <div class="flex-container html-exporter-actions">
                            <input id="${extensionId}-export-all" class="menu_button" type="button" value="&#23548;&#20986;&#24403;&#21069;&#28210;&#26579;&#27004;&#23618;">
                            <input id="${extensionId}-render-range-to-page" class="menu_button" type="button" value="\u6e32\u67d3\u9009\u5b9a\u8303\u56f4\u5230\u9875\u9762">
                            <input id="${extensionId}-restore-range" class="menu_button" type="button" value="&#24674;&#22797;&#21407;&#39029;&#38754;" disabled>
                            <input id="${extensionId}-toggle-select" class="menu_button" type="button" value="&#33258;&#23450;&#20041;&#21246;&#36873;">
                            <input id="${extensionId}-toggle-select-all" class="menu_button" type="button" value="\u5168\u9009" disabled>
                            <input id="${extensionId}-export-selected" class="menu_button" type="button" value="&#23548;&#20986;&#24050;&#21246;&#36873;" disabled>
                            <input id="${extensionId}-cancel-select" class="menu_button" type="button" value="&#21462;&#28040;&#21246;&#36873;" disabled>
                            <input id="${extensionId}-open-search" class="menu_button" type="button" value="\u641c\u7d22\u804a\u5929\u8bb0\u5f55">
                        </div>
                        <div class="html-exporter-status-row">
                            <small id="${extensionId}-status" class="notes html-exporter-status">&#23548;&#20986;&#33539;&#22260;&#65306;&#24403;&#21069;&#39029;&#38754;&#24050;&#32463;&#28210;&#26579;&#20986;&#26469;&#30340;&#32842;&#22825;&#27004;&#23618;&#12290;</small>
                            <input id="${extensionId}-cancel-export" class="menu_button html-exporter-cancel-export" type="button" value="&#21462;&#28040;&#23548;&#20986;" disabled>
                        </div>
                    </div>
                </div>
            </div>
        `);

        document.getElementById(`${extensionId}-export-all`)?.addEventListener('click', () => exportRenderedMessages(false));
        document.getElementById(`${extensionId}-render-range-to-page`)?.addEventListener('click', renderRangeToPage);
        document.getElementById(`${extensionId}-restore-range`)?.addEventListener('click', restoreRangeFromPage);
        document.getElementById(`${extensionId}-toggle-select`)?.addEventListener('click', enableSelectionMode);
        document.getElementById(`${extensionId}-toggle-select-all`)?.addEventListener('click', toggleAllSelectedMessages);
        document.getElementById(`${extensionId}-export-selected`)?.addEventListener('click', () => exportRenderedMessages(true));
        document.getElementById(`${extensionId}-cancel-select`)?.addEventListener('click', disableSelectionMode);
        document.getElementById(`${extensionId}-open-search`)?.addEventListener('click', openChatSearchModal);
        document.getElementById(`${extensionId}-cancel-export`)?.addEventListener('click', cancelActiveExport);
        eventSource.on(event_types.MESSAGE_DELETED, syncActiveTemporaryRangeAfterDeletion);
        eventSource.on(event_types.CHAT_CHANGED, discardActiveTemporaryRender);
        window.addEventListener('pagehide', restoreActiveTemporaryRender);
        window.addEventListener('beforeunload', restoreActiveTemporaryRender);
        updateTemporaryRenderButtons();
    }

    async function exportRenderedMessages(onlySelected) {
        if (activeExportTask) {
            notify('\u5df2\u6709\u5bfc\u51fa\u4efb\u52a1\u5728\u8fdb\u884c\u3002', 'warning');
            return;
        }

        const exportTask = createExportTask();
        const buttonIds = [
            `${extensionId}-export-all`,
            `${extensionId}-render-range-to-page`,
            `${extensionId}-restore-range`,
            `${extensionId}-toggle-select`,
            `${extensionId}-toggle-select-all`,
            `${extensionId}-export-selected`,
            `${extensionId}-cancel-select`,
            `${extensionId}-open-search`,
        ];
        let finalStatus = '\u5bfc\u51fa\u8303\u56f4\uff1a\u5f53\u524d\u9875\u9762\u5df2\u7ecf\u6e32\u67d3\u51fa\u6765\u7684\u804a\u5929\u697c\u5c42\u3002';

        try {
            activeExportTask = exportTask;
            setButtonsDisabled(buttonIds, true);
            updateCancelExportButton();

            const sourceMessages = getSourceMessages(onlySelected);
            const exportedFloors = sourceMessages.map(getMessageFloor).filter(Number.isInteger);

            if (!sourceMessages.length || !exportedFloors.length) {
                notify('\u6ca1\u6709\u627e\u5230\u53ef\u5bfc\u51fa\u7684\u804a\u5929\u697c\u5c42\u3002', 'warning');
                return;
            }

            const favorites = parseFavoritesInput();
            const chapterRanges = parseChapterInput();
            const chapterPlan = buildChapterPlan(exportedFloors, chapterRanges);
            validateFavorites(favorites, exportedFloors);
            const exportOptions = getExportOptions();

            setStatus(`\u6b63\u5728\u514b\u9686 ${sourceMessages.length} \u4e2a\u697c\u5c42...`);
            const exportRoot = buildExportRoot(sourceMessages, chapterPlan, exportOptions);
            throwIfExportCancelled(exportTask);
            if (exportOptions.preserveTheme && !exportOptions.copyPageStyles) {
                setStatus('\u6b63\u5728\u5199\u5165\u804a\u5929\u533a\u6837\u5f0f\u5feb\u7167...');
                await applyMessageStyleSnapshots(sourceMessages, exportRoot, exportTask);
            }
            removeUnwantedControls(exportRoot);
            normalizeExportDom(exportRoot);
            throwIfExportCancelled(exportTask);

            if (document.getElementById(`${extensionId}-embed-assets`)?.checked) {
                await inlineElementAssets(exportRoot, exportTask);
            }

            const backgroundSnapshot = exportOptions.preserveBackground
                ? await captureVisualBackgroundSnapshot(exportOptions.embedAssets, exportTask)
                : null;
            const compressionPreset = getImageCompressionPreset(exportOptions.imageCompressionPreset);
            if (compressionPreset) {
                const compressionCache = new Map();
                const compressionSummary = await compressEmbeddedImages(exportRoot, compressionPreset, compressionCache, exportTask);
                notifyImageCompressionSummary(compressionSummary, compressionPreset);
            }

            const assetMap = exportOptions.dedupeAssets ? dedupeEmbeddedAssets(exportRoot) : {};
            const readerData = buildReaderData(exportedFloors, favorites, chapterPlan);

            setStatus(exportOptions.copyPageStyles ? '\u6b63\u5728\u6536\u96c6\u5b8c\u6574\u9875\u9762 CSS...' : '\u6b63\u5728\u751f\u6210 HTML...');
            const html = await buildHtmlDocument(exportRoot, sourceMessages.length, exportOptions, backgroundSnapshot, assetMap, readerData, exportTask);
            throwIfExportCancelled(exportTask);
            downloadHtmlFile(html, getExportFileName());
            notify(`HTML\u5bfc\u51fa\u5b8c\u6210\uff1a${sourceMessages.length} \u4e2a\u697c\u5c42\u3002`);

            if (onlySelected) {
                disableSelectionMode();
            }
        } catch (error) {
            if (isExportCancelled(error, exportTask)) {
                finalStatus = '\u5df2\u53d6\u6d88\u5bfc\u51fa\uff0c\u5f53\u524d\u9875\u9762\u6e32\u67d3\u60c5\u51b5\u4fdd\u6301\u4e0d\u53d8\u3002';
                notify('\u5df2\u53d6\u6d88\u5bfc\u51fa\uff0c\u5f53\u524d\u9875\u9762\u6e32\u67d3\u60c5\u51b5\u4fdd\u6301\u4e0d\u53d8\u3002', 'info');
                return;
            }

            console.error('[拾玉-HTML导出] export failed:', error);
            notify(`\u5bfc\u51fa\u5931\u8d25\uff1a${error.message || error}`, 'error');
        } finally {
            if (activeExportTask === exportTask) {
                activeExportTask = null;
            }
            setButtonsDisabled(buttonIds, false);
            updateCancelExportButton();
            updateSelectionButtons();
            updateTemporaryRenderButtons();
            setStatus(finalStatus);
        }
    }

    function createExportTask() {
        const controller = new AbortController();
        return {
            controller,
            signal: controller.signal,
            cancelled: false,
            assetCache: new Map(),
            assetFetchScheduler: {
                active: 0,
                queue: [],
            },
        };
    }

    function cancelActiveExport() {
        const task = activeExportTask || activeRenderTask;
        if (!task || task.cancelled) {
            return;
        }

        task.cancelled = true;
        task.controller.abort();
        updateCancelExportButton();
        setStatus(activeRenderTask === task
            ? '\u6b63\u5728\u53d6\u6d88\u4e34\u65f6\u6e32\u67d3...'
            : '\u6b63\u5728\u53d6\u6d88\u5bfc\u51fa...');
    }

    function updateCancelExportButton() {
        const button = document.getElementById(`${extensionId}-cancel-export`);
        if (!button) {
            return;
        }

        const task = activeExportTask || activeRenderTask;
        button.disabled = !task || task.cancelled;
    }

    function throwIfExportCancelled(exportTask) {
        if (exportTask?.cancelled || exportTask?.signal?.aborted) {
            throw createExportCancelledError();
        }
    }

    function createExportCancelledError() {
        const error = new Error('\u5bfc\u51fa\u5df2\u53d6\u6d88');
        error.name = 'ExportCancelledError';
        return error;
    }

    function isExportCancelled(error, exportTask) {
        return Boolean(exportTask?.cancelled || exportTask?.signal?.aborted || error?.name === 'ExportCancelledError');
    }

    function getExportOptions() {
        return {
            embedAssets: Boolean(document.getElementById(`${extensionId}-embed-assets`)?.checked),
            dedupeAssets: true,
            imageCompressionPreset: getSelectedImageCompressionPreset(),
            copyPageStyles: Boolean(document.getElementById(`${extensionId}-inline-style-assets`)?.checked),
            preserveMessageChrome: Boolean(document.getElementById(`${extensionId}-preserve-message-chrome`)?.checked),
            indentParagraphs: Boolean(document.getElementById(`${extensionId}-indent-paragraphs`)?.checked),
            preserveTheme: Boolean(document.getElementById(`${extensionId}-preserve-theme`)?.checked),
            preserveBackground: Boolean(document.getElementById(`${extensionId}-preserve-background`)?.checked),
            includeOutsideStatus: Boolean(document.getElementById(`${extensionId}-include-outside-status`)?.checked),
        };
    }

    function getSelectedImageCompressionPreset() {
        const select = document.getElementById(`${extensionId}-image-compression`);
        const value = select instanceof HTMLSelectElement ? select.value : 'none';
        return Object.prototype.hasOwnProperty.call(imageCompressionPresets, value) ? value : 'none';
    }

    function getImageCompressionPreset(name) {
        return imageCompressionPresets[name] || null;
    }

    function parseRenderRangeInput() {
        const input = document.getElementById(`${extensionId}-render-range-input`);
        const value = input instanceof HTMLInputElement ? input.value.trim() : '';
        if (!value) {
            throw new Error('\u8bf7\u5148\u586b\u5199\u8981\u4e34\u65f6\u6e32\u67d3\u7684\u697c\u5c42\u8303\u56f4\uff0c\u4f8b\u5982 300 \u6216 300-399\u3002');
        }

        const match = value.match(/^#?\s*(\d+)\s*(?:(?:-|~|\u5230|\u81f3)\s*#?\s*(\d+))?$/);
        if (!match) {
            throw new Error(`\u4e34\u65f6\u6e32\u67d3\u697c\u5c42\u8303\u56f4\u65e0\u6548\uff1a${value}`);
        }

        const start = Number(match[1]);
        const end = match[2] === undefined ? start : Number(match[2]);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
            throw new Error(`\u4e34\u65f6\u6e32\u67d3\u697c\u5c42\u8303\u56f4\u65e0\u6548\uff1a${value}`);
        }

        if (!tavernChat.length) {
            throw new Error('\u5f53\u524d\u804a\u5929\u6ca1\u6709\u53ef\u6e32\u67d3\u7684\u697c\u5c42\u3002');
        }

        const lastFloor = tavernChat.length - 1;
        if (start < 0 || end > lastFloor) {
            throw new Error(`\u4e34\u65f6\u6e32\u67d3\u697c\u5c42\u8d85\u51fa\u5f53\u524d\u804a\u5929\u8303\u56f4\uff1a#0-#${lastFloor}`);
        }

        return { start, end };
    }

    async function renderRangeToPage() {
        const buttonIds = [
            `${extensionId}-export-all`,
            `${extensionId}-render-range-to-page`,
            `${extensionId}-restore-range`,
            `${extensionId}-toggle-select`,
            `${extensionId}-toggle-select-all`,
            `${extensionId}-export-selected`,
            `${extensionId}-cancel-select`,
            `${extensionId}-open-search`,
        ];
        const renderTask = createExportTask();

        try {
            activeRenderTask = renderTask;
            setButtonsDisabled(buttonIds, true);
            updateCancelExportButton();
            await restoreActiveTemporaryRender();

            const range = parseRenderRangeInput();
            activeTemporaryRender = await renderTemporaryRange(range, renderTask);

            notify(`\u5df2\u5c06 #${range.start}-#${range.end} \u6e32\u67d3\u5230\u771f\u5b9e\u804a\u5929\u533a\u3002`);
            setStatus(`\u5df2\u4e34\u65f6\u663e\u793a #${range.start}-#${range.end}\uff1a\u786e\u8ba4\u6b63\u5219\u3001\u56fe\u7247\u548c\u7f8e\u5316\u6b63\u5e38\u540e\uff0c\u70b9\u201c\u5bfc\u51fa\u5f53\u524d\u6e32\u67d3\u697c\u5c42\u201d\u5373\u53ef\u3002`);
        } catch (error) {
            if (isExportCancelled(error, renderTask)) {
                notify('\u5df2\u53d6\u6d88\u4e34\u65f6\u6e32\u67d3\uff0c\u5df2\u6062\u590d\u539f\u804a\u5929\u9875\u9762\u3002', 'info');
                return;
            }

            console.error('[拾玉-HTML导出] render range failed:', error);
            notify(`\u6e32\u67d3\u8303\u56f4\u5931\u8d25\uff1a${error.message || error}`, 'error');
        } finally {
            if (activeRenderTask === renderTask) {
                activeRenderTask = null;
            }
            setButtonsDisabled(buttonIds, false);
            updateCancelExportButton();
            updateSelectionButtons();
            updateTemporaryRenderButtons();
        }
    }

    async function restoreRangeFromPage() {
        if (await restoreActiveTemporaryRender()) {
            notify('\u5df2\u6062\u590d\u539f\u804a\u5929\u9875\u9762\u3002');
            setStatus('\u5bfc\u51fa\u8303\u56f4\uff1a\u5f53\u524d\u9875\u9762\u5df2\u7ecf\u6e32\u67d3\u51fa\u6765\u7684\u804a\u5929\u697c\u5c42\u3002');
        }
    }

    async function restoreActiveTemporaryRender() {
        if (!activeTemporaryRender) {
            return false;
        }

        await activeTemporaryRender.restore();
        activeTemporaryRender = null;
        updateTemporaryRenderButtons();
        return true;
    }

    function discardActiveTemporaryRender() {
        if (!activeTemporaryRender) {
            return;
        }

        activeTemporaryRender = null;
        updateTemporaryRenderButtons();
    }

    function updateTemporaryRenderButtons() {
        const restoreButton = document.getElementById(`${extensionId}-restore-range`);
        if (restoreButton) {
            restoreButton.disabled = !activeTemporaryRender;
        }
    }

    async function syncActiveTemporaryRangeAfterDeletion() {
        if (!activeTemporaryRender) {
            return;
        }

        if (activeTemporaryRender.isRefreshing) {
            return;
        }

        const chatContainer = getChatContainer();
        const range = clampRangeToChat(activeTemporaryRender.requestedRange);
        if (!chatContainer || !range) {
            discardActiveTemporaryRender();
            notify('\u5220\u9664\u540e\u76ee\u6807\u697c\u5c42\u5df2\u4e0d\u5b58\u5728\uff0c\u5df2\u7ed3\u675f\u4e34\u65f6\u6e32\u67d3\u3002', 'warning');
            return;
        }

        activeTemporaryRender.isRefreshing = true;
        activeTemporaryRender.isDirty = true;

        try {
            setStatus(`\u5220\u9664\u540e\u6b63\u5728\u540c\u6b65\u4e34\u65f6\u697c\u5c42 #${range.start}-#${range.end}...`);
            const result = await patchRangeIntoChat(chatContainer, range, activeTemporaryRender.tavernHelperRenderScope);
            activeTemporaryRender.range = range;
            setStatus(`\u5df2\u8865\u9f50\u4e34\u65f6\u697c\u5c42 #${range.start}-#${range.end}\uff1a\u4fdd\u7559 ${result.retainedCount} \u5c42\uff0c\u65b0\u589e ${result.createdCount} \u5c42\u3002`);
        } catch (error) {
            console.error('[拾玉-HTML导出] failed to sync temporary range after deletion:', error);
            notify(`\u5220\u9664\u540e\u540c\u6b65\u4e34\u65f6\u697c\u5c42\u5931\u8d25\uff1a${error.message || error}`, 'error');
            discardActiveTemporaryRender();
        } finally {
            if (activeTemporaryRender) {
                activeTemporaryRender.isRefreshing = false;
            }
            updateTemporaryRenderButtons();
        }
    }

    async function renderTemporaryRange(range, renderTask) {
        const chatContainer = getChatContainer();
        if (!chatContainer) {
            throw new Error('\u6ca1\u6709\u627e\u5230\u804a\u5929\u533a\u57df\u3002');
        }

        const originalScrollTop = chatContainer.scrollTop;
        const originalDisplayedRange = getDisplayedMessageRange(chatContainer);
        const tavernHelperRenderScope = await createTavernHelperRenderScope(range, renderTask);
        const originalNodes = document.createDocumentFragment();
        while (chatContainer.firstChild) {
            originalNodes.appendChild(chatContainer.firstChild);
        }

        let restored = false;
        const restore = async () => {
            if (restored) {
                return;
            }

            await tavernHelperRenderScope.prepareRestore();
            if (temporaryRender.isDirty && temporaryRender.originalDisplayedRange) {
                const restoreRange = clampRangeToChat(temporaryRender.originalDisplayedRange);
                if (restoreRange) {
                    await renderRangeIntoChat(chatContainer, restoreRange);
                } else {
                    chatContainer.replaceChildren();
                }
            } else {
                chatContainer.replaceChildren(originalNodes);
                refreshSwipeButtons(false, false);
                applyStylePins();
                updateEditArrowClasses();
            }

            chatContainer.scrollTop = originalScrollTop;
            await tavernHelperRenderScope.restore(originalDisplayedRange);
            restored = true;
        };
        const temporaryRender = {
            requestedRange: { ...range },
            range: { ...range },
            originalDisplayedRange,
            tavernHelperRenderScope,
            restore,
            isDirty: false,
            isRefreshing: false,
        };

        try {
            setStatus(`\u6b63\u5728\u4e34\u65f6\u6e32\u67d3 #${range.start}-#${range.end}...`);
            await renderRangeIntoChat(chatContainer, range, tavernHelperRenderScope, renderTask);
            return temporaryRender;
        } catch (error) {
            await restore();
            throw error;
        }
    }

    async function createTavernHelperRenderScope(range, renderTask) {
        throwIfExportCancelled(renderTask);
        const enabledInput = document.getElementById('TH-render-enabled');
        if (enabledInput instanceof HTMLInputElement && !enabledInput.checked) {
            throw new Error('\u9152\u9986\u52a9\u624b\u7684\u201c\u542f\u7528\u6e32\u67d3\u5668\u201d\u5df2\u5173\u95ed\uff0c\u65e0\u6cd5\u6e32\u67d3\u524d\u7aef\u7f8e\u5316\u3002');
        }

        const depthInput = findTavernHelperRenderDepthInput();
        if (!(depthInput instanceof HTMLInputElement)) {
            return createFallbackTavernHelperRenderScope(range);
        }

        const originalDepth = depthInput.valueAsNumber;
        if (!Number.isFinite(originalDepth)) {
            return createFallbackTavernHelperRenderScope(range);
        }

        await setTavernHelperRenderDepth(depthInput, 1);

        return {
            activate: async () => {
                const targetDepth = Math.max(1, tavernChat.length - range.start);
                await setTavernHelperRenderDepth(depthInput, targetDepth);
                for (let floor = range.start; floor <= range.end; floor++) {
                    throwIfExportCancelled(renderTask);
                    await refreshRenderedMessage(floor);
                }
            },
            prepareRestore: async () => {
                await setTavernHelperRenderDepth(depthInput, 1);
            },
            restore: async displayedRange => {
                await setTavernHelperRenderDepth(depthInput, originalDepth);
                if (displayedRange) {
                    for (let floor = displayedRange.start; floor <= displayedRange.end; floor++) {
                        await refreshRenderedMessage(floor);
                    }
                }
            },
        };
    }

    function createFallbackTavernHelperRenderScope(range) {
        return {
            activate: async () => {
                for (let floor = range.start; floor <= range.end; floor++) {
                    await refreshRenderedMessage(floor);
                }
            },
            prepareRestore: async () => {},
            restore: async () => {},
        };
    }

    function findTavernHelperRenderDepthInput() {
        const title = Array.from(document.querySelectorAll('.TH-Item--title'))
            .find(element => element.textContent?.trim() === '\u6e32\u67d3\u6df1\u5ea6');
        return title?.parentElement?.nextElementSibling?.querySelector('input[type="number"]') || null;
    }

    async function setTavernHelperRenderDepth(input, value) {
        if (input.valueAsNumber === value) {
            return;
        }

        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await nextFrame();
        await nextAnimationFrame();
    }

    async function refreshRenderedMessage(floor) {
        const message = tavernChat[floor];
        if (!message) {
            return;
        }

        const event = message.is_user
            ? event_types.USER_MESSAGE_RENDERED
            : event_types.CHARACTER_MESSAGE_RENDERED;
        await eventSource.emit(event, floor);
    }

    function getChatContainer() {
        return tavernChatElement?.[0] || document.querySelector('#chat');
    }

    function getDisplayedMessageRange(chatContainer) {
        const messages = Array.from(chatContainer.querySelectorAll(':scope > .mes'));
        const floors = messages.map(getMessageFloor).filter(Number.isInteger);
        if (!floors.length) {
            return null;
        }

        return {
            start: floors[0],
            end: floors[floors.length - 1],
        };
    }

    function clampRangeToChat(range) {
        if (!range || !tavernChat.length) {
            return null;
        }

        const lastFloor = tavernChat.length - 1;
        if (range.start > lastFloor) {
            return null;
        }

        return {
            start: range.start,
            end: Math.min(range.end, lastFloor),
        };
    }

    async function renderRangeIntoChat(chatContainer, range, tavernHelperRenderScope = null, renderTask = null) {
        const fragment = document.createDocumentFragment();
        const renderedIds = [];

        for (let messageId = range.start; messageId <= range.end; messageId++) {
            throwIfExportCancelled(renderTask);
            const message = tavernChat[messageId];
            if (!message) {
                throw new Error(`\u627e\u4e0d\u5230\u804a\u5929\u697c\u5c42 #${messageId}\u3002`);
            }

            const messageElement = updateMessageElement(message, { messageId });
            fragment.appendChild(messageElement[0]);
            renderedIds.push(messageId);
        }

        const lastMessage = fragment.lastElementChild;
        if (lastMessage) {
            lastMessage.classList.add('last_mes');
        }

        chatContainer.replaceChildren(fragment);
        applyCharacterTagsToMessageDivs({ mesIds: renderedIds });
        refreshSwipeButtons(false, false);
        applyStylePins();
        updateEditArrowClasses();
        await tavernHelperRenderScope?.activate();
        await notifyTemporaryRangeLoaded();

        setStatus(`\u6b63\u5728\u7b49\u5f85 #${range.start}-#${range.end} \u7684\u524d\u7aef\u7f8e\u5316\u5b8c\u6210...`);
        await waitForTemporaryRender(chatContainer, renderTask);
    }

    async function patchRangeIntoChat(chatContainer, range, tavernHelperRenderScope = null) {
        const fragment = document.createDocumentFragment();
        const existingMessages = Array.from(chatContainer.querySelectorAll(':scope > .mes'));
        const messagesByFloor = new Map();
        const displayedIds = [];
        const createdElements = [];
        let retainedCount = 0;

        for (const messageElement of existingMessages) {
            const floor = getMessageFloor(messageElement);
            if (Number.isInteger(floor) && !messagesByFloor.has(floor)) {
                messagesByFloor.set(floor, messageElement);
            }
        }

        for (let messageId = range.start; messageId <= range.end; messageId++) {
            displayedIds.push(messageId);
            const existingMessage = messagesByFloor.get(messageId);
            if (existingMessage) {
                fragment.appendChild(existingMessage);
                retainedCount++;
            } else {
                const message = tavernChat[messageId];
                if (!message) {
                    throw new Error(`\u627e\u4e0d\u5230\u804a\u5929\u697c\u5c42 #${messageId}\u3002`);
                }

                const messageElement = updateMessageElement(message, { messageId })[0];
                fragment.appendChild(messageElement);
                createdElements.push(messageElement);
            }
        }

        const lastMessage = fragment.lastElementChild;
        if (lastMessage) {
            for (const message of fragment.querySelectorAll('.mes')) {
                message.classList.remove('last_mes');
            }
            lastMessage.classList.add('last_mes');
        }

        chatContainer.replaceChildren(fragment);
        applyCharacterTagsToMessageDivs({ mesIds: displayedIds });
        refreshSwipeButtons(false, false);
        applyStylePins();
        updateEditArrowClasses();
        await tavernHelperRenderScope?.activate();
        await notifyTemporaryRangeLoaded();

        if (createdElements.length) {
            setStatus('\u6b63\u5728\u7b49\u5f85\u65b0\u8865\u5165\u697c\u5c42\u7684\u524d\u7aef\u7f8e\u5316\u5b8c\u6210...');
            await waitForTemporaryRender(chatContainer);
        }

        return {
            retainedCount,
            createdCount: createdElements.length,
        };
    }

    async function notifyTemporaryRangeLoaded() {
        await nextFrame();
        await eventSource.emit(event_types.MORE_MESSAGES_LOADED);
        await nextFrame();
    }

    async function waitForTemporaryRender(chatContainer, renderTask = null) {
        throwIfExportCancelled(renderTask);
        await nextAnimationFrame();
        await nextFrame();
        await waitForFrontendRenders(chatContainer, frontendRenderTimeoutMs, renderTask);
        throwIfExportCancelled(renderTask);
        await nextAnimationFrame();
    }

    async function waitForFrontendRenders(chatContainer, timeoutMs, renderTask) {
        throwIfExportCancelled(renderTask);
        const frontendBlocks = Array.from(chatContainer.querySelectorAll('pre')).filter(isFrontendCodeBlock);
        if (!frontendBlocks.length) {
            return;
        }

        await new Promise((resolve, reject) => {
            let observer;
            let timeout;
            let settled = false;
            const observedFrames = new WeakSet();
            const loadedFrames = new WeakSet();

            const cleanup = () => {
                settled = true;
                observer?.disconnect();
                clearTimeout(timeout);
                renderTask?.signal?.removeEventListener('abort', onAbort);
            };
            const onAbort = () => {
                if (settled) {
                    return;
                }

                cleanup();
                reject(createExportCancelledError());
            };
            const check = () => {
                if (settled) {
                    return;
                }

                for (const pre of frontendBlocks) {
                    const frame = pre.parentElement?.querySelector(':scope > iframe');
                    if (frame instanceof HTMLIFrameElement && !observedFrames.has(frame)) {
                        observedFrames.add(frame);
                        frame.loading = 'eager';
                        frame.addEventListener('load', () => {
                            loadedFrames.add(frame);
                            check();
                        }, { once: true });
                    }
                }

                const renderedCount = countCompletedFrontendRenders(frontendBlocks, loadedFrames);
                setStatus(`\u6b63\u5728\u7b49\u5f85\u524d\u7aef\u7f8e\u5316\u5b8c\u6210 ${renderedCount}/${frontendBlocks.length}...`);
                if (renderedCount === frontendBlocks.length) {
                    cleanup();
                    resolve();
                }
            };

            observer = new MutationObserver(check);
            observer.observe(chatContainer, { childList: true, subtree: true });
            renderTask?.signal?.addEventListener('abort', onAbort, { once: true });
            timeout = setTimeout(() => {
                cleanup();
                reject(new Error(`\u9152\u9986\u52a9\u624b\u524d\u7aef\u7f8e\u5316\u53ea\u5b8c\u6210 ${countCompletedFrontendRenders(frontendBlocks, loadedFrames)}/${frontendBlocks.length}\uff0c\u8bf7\u68c0\u67e5\u5176\u6e32\u67d3\u5668\u662f\u5426\u5df2\u542f\u7528\u3002`));
            }, timeoutMs);

            check();
        });
    }

    function countCompletedFrontendRenders(frontendBlocks, loadedFrames) {
        return frontendBlocks.filter(pre => {
            const frame = pre.parentElement?.querySelector(':scope > iframe');
            return frame instanceof HTMLIFrameElement
                && (loadedFrames.has(frame) || frame.contentDocument?.readyState === 'complete');
        }).length;
    }

    function isFrontendCodeBlock(pre) {
        const content = pre.textContent || '';
        return ['html>', '<head>', '<body'].some(tag => content.includes(tag));
    }

    function openChatSearchModal() {
        const modal = getOrCreateChatSearchModal();
        modal.hidden = false;

        const input = modal.querySelector('[data-search-input]');
        if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
        }
    }

    function getOrCreateChatSearchModal() {
        let modal = document.getElementById(`${extensionId}-search-modal`);
        if (modal) {
            return modal;
        }

        modal = document.createElement('div');
        modal.id = `${extensionId}-search-modal`;
        modal.className = 'html-exporter-search-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <section class="html-exporter-search-panel" role="dialog" aria-modal="true" aria-labelledby="${extensionId}-search-title">
                <div class="html-exporter-search-header">
                    <h2 id="${extensionId}-search-title">\u641c\u7d22\u804a\u5929\u8bb0\u5f55</h2>
                    <button class="menu_button html-exporter-search-close" type="button" data-search-close aria-label="\u5173\u95ed">\u00d7</button>
                </div>
                <div class="html-exporter-search-row">
                    <input class="text_pole html-exporter-search-input" data-search-input type="search" spellcheck="false" placeholder="\u8f93\u5165\u5173\u952e\u5b57">
                    <button class="menu_button html-exporter-search-submit" type="button" data-search-submit>\u641c\u7d22</button>
                </div>
                <p class="notes html-exporter-search-help">\u76f4\u63a5\u641c\u7d22\u5f53\u524d\u804a\u5929\u5185\u5b58\u4e2d\u7684\u539f\u59cb\u6d88\u606f\u6587\u672c\uff0c\u4e0d\u6e32\u67d3\u804a\u5929\u6b63\u6587\u3002\u9884\u89c8\u663e\u793a\u5173\u952e\u5b57\u524d\u540e\u7ea6 50 \u4e2a\u5b57\u3002</p>
                <p class="html-exporter-search-status" data-search-status>\u8f93\u5165\u5173\u952e\u5b57\u540e\u5f00\u59cb\u641c\u7d22\u3002</p>
                <div class="html-exporter-search-results" data-search-results></div>
            </section>
        `;

        modal.addEventListener('click', event => handleChatSearchClick(event, modal));
        modal.addEventListener('keydown', event => handleChatSearchKeydown(event, modal));
        document.body.appendChild(modal);
        return modal;
    }

    function handleChatSearchClick(event, modal) {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        if (target === modal || target.closest('[data-search-close]')) {
            closeChatSearchModal();
            return;
        }

        if (target.closest('[data-search-submit]')) {
            runChatSearch(modal);
            return;
        }

        const fillButton = target.closest('[data-search-fill-range]');
        if (fillButton instanceof HTMLElement) {
            fillSearchResultRange(fillButton.getAttribute('data-floor'));
        }
    }

    function handleChatSearchKeydown(event, modal) {
        if (event.key === 'Escape') {
            closeChatSearchModal();
            return;
        }

        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            runChatSearch(modal);
        }
    }

    function closeChatSearchModal() {
        const modal = document.getElementById(`${extensionId}-search-modal`);
        if (modal) {
            modal.hidden = true;
        }
    }

    function runChatSearch(modal) {
        const input = modal.querySelector('[data-search-input]');
        const status = modal.querySelector('[data-search-status]');
        const resultsContainer = modal.querySelector('[data-search-results]');
        const query = input instanceof HTMLInputElement ? input.value.trim() : '';

        if (!(resultsContainer instanceof HTMLElement) || !(status instanceof HTMLElement)) {
            return;
        }

        resultsContainer.replaceChildren();
        if (!query) {
            status.textContent = '\u8bf7\u5148\u8f93\u5165\u8981\u641c\u7d22\u7684\u5173\u952e\u5b57\u3002';
            return;
        }

        const searchResult = searchChatMessages(query);
        status.textContent = buildSearchStatusText(searchResult);
        renderSearchResults(resultsContainer, searchResult.results);
    }

    function searchChatMessages(query) {
        const queryLower = query.toLocaleLowerCase();
        const results = [];
        let matchedFloors = 0;
        let totalMatches = 0;

        for (let floor = 0; floor < tavernChat.length; floor++) {
            const message = tavernChat[floor];
            const text = getSearchableMessageText(message);
            if (!text) {
                continue;
            }

            const textLower = text.toLocaleLowerCase();
            const matchIndex = textLower.indexOf(queryLower);
            if (matchIndex === -1) {
                continue;
            }

            const matchCount = countSearchMatches(textLower, queryLower);
            matchedFloors++;
            totalMatches += matchCount;

            if (results.length < searchResultLimit) {
                results.push({
                    floor,
                    name: message?.name || '',
                    isUser: Boolean(message?.is_user),
                    matchCount,
                    preview: buildSearchPreview(text, matchIndex, query.length),
                });
            }
        }

        return {
            matchedFloors,
            totalMatches,
            shown: results.length,
            limited: matchedFloors > results.length,
            results,
        };
    }

    function getSearchableMessageText(message) {
        if (!message) {
            return '';
        }

        const parts = [];
        if (typeof message.mes === 'string') {
            parts.push(message.mes);
        }

        const displayText = message.extra?.display_text;
        if (typeof displayText === 'string' && displayText !== message.mes) {
            parts.push(displayText);
        }

        const reasoning = message.extra?.reasoning;
        if (typeof reasoning === 'string') {
            parts.push(reasoning);
        }

        return parts.join('\n\n');
    }

    function countSearchMatches(textLower, queryLower) {
        let count = 0;
        let index = 0;

        while (index < textLower.length) {
            const nextIndex = textLower.indexOf(queryLower, index);
            if (nextIndex === -1) {
                break;
            }

            count++;
            index = nextIndex + queryLower.length;
        }

        return count;
    }

    function buildSearchPreview(text, index, length) {
        const start = Math.max(0, index - searchContextChars);
        const end = Math.min(text.length, index + length + searchContextChars);
        return {
            hasPrefix: start > 0,
            before: normalizeSearchPreviewText(text.slice(start, index)),
            match: normalizeSearchPreviewText(text.slice(index, index + length)),
            after: normalizeSearchPreviewText(text.slice(index + length, end)),
            hasSuffix: end < text.length,
        };
    }

    function normalizeSearchPreviewText(value) {
        return String(value).replace(/\s+/g, ' ').trim();
    }

    function buildSearchStatusText(result) {
        if (!result.matchedFloors) {
            return '\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u697c\u5c42\u3002';
        }

        const limitedText = result.limited ? `\uff0c\u4ec5\u663e\u793a\u524d ${result.shown} \u6761` : '';
        return `\u627e\u5230 ${result.matchedFloors} \u4e2a\u697c\u5c42\uff0c${result.totalMatches} \u5904\u5339\u914d${limitedText}\u3002`;
    }

    function renderSearchResults(container, results) {
        if (!results.length) {
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const result of results) {
            fragment.appendChild(buildSearchResultElement(result));
        }
        container.replaceChildren(fragment);
    }

    function buildSearchResultElement(result) {
        const item = document.createElement('article');
        item.className = 'html-exporter-search-result';

        const header = document.createElement('div');
        header.className = 'html-exporter-search-result-header';

        const floorButton = document.createElement('button');
        floorButton.className = 'menu_button html-exporter-search-floor';
        floorButton.type = 'button';
        floorButton.dataset.searchFillRange = '';
        floorButton.dataset.floor = String(result.floor);
        floorButton.textContent = `#${result.floor}`;
        floorButton.title = '\u586b\u5165\u4e34\u65f6\u6e32\u67d3\u8303\u56f4';

        const meta = document.createElement('span');
        meta.className = 'html-exporter-search-meta';
        const speaker = result.name || (result.isUser ? 'User' : 'Assistant');
        meta.textContent = result.matchCount > 1 ? `${speaker} \u00b7 ${result.matchCount} \u5904\u5339\u914d` : speaker;

        header.append(floorButton, meta);

        const preview = document.createElement('p');
        preview.className = 'html-exporter-search-preview';
        appendSearchPreview(preview, result.preview);

        item.append(header, preview);
        return item;
    }

    function appendSearchPreview(container, preview) {
        if (preview.hasPrefix) {
            container.append(document.createTextNode('...'));
        }
        container.append(document.createTextNode(preview.before));

        const mark = document.createElement('mark');
        mark.textContent = preview.match;
        container.append(mark);

        container.append(document.createTextNode(preview.after));
        if (preview.hasSuffix) {
            container.append(document.createTextNode('...'));
        }
    }

    function fillSearchResultRange(floor) {
        const input = document.getElementById(`${extensionId}-render-range-input`);
        if (input instanceof HTMLInputElement && floor) {
            input.value = floor;
            setStatus(`\u5df2\u5c06 #${floor} \u586b\u5165\u4e34\u65f6\u6e32\u67d3\u8303\u56f4\u3002`);
        }
    }

    function getSourceMessages(onlySelected) {
        const chat = document.querySelector('#chat');
        if (!chat) {
            return [];
        }

        const messages = Array.from(chat.querySelectorAll(':scope > .mes'));
        if (!onlySelected) {
            return messages;
        }

        return messages.filter(message => {
            const checkbox = message.querySelector(`.${checkboxClass} input[type="checkbox"]`);
            return checkbox?.checked;
        });
    }

    function getMessageFloor(message) {
        const floor = Number(message.getAttribute('mesid'));
        return Number.isInteger(floor) ? floor : null;
    }

    function parseFavoritesInput() {
        const textarea = document.getElementById(`${extensionId}-favorites`);
        const value = textarea instanceof HTMLTextAreaElement ? textarea.value.trim() : '';
        if (!value) {
            return [];
        }

        const favoritesByFloor = new Map();
        const lines = value.split(/\r?\n|;/).map(line => line.trim()).filter(Boolean);

        for (const line of lines) {
            const parts = splitConfigLine(line);
            const floors = parseFloorList(parts.left);
            const metadata = parseFavoriteMetadata(parts.right);

            if (!floors.length) {
                throw new Error(`\u6536\u85cf\u697c\u5c42\u65e0\u6548\uff1a${line}`);
            }

            for (const floor of floors) {
                favoritesByFloor.set(floor, {
                    floor,
                    tag: metadata.tag,
                    note: metadata.note,
                });
            }
        }

        return Array.from(favoritesByFloor.values()).sort((a, b) => a.floor - b.floor);
    }

    function parseFavoriteMetadata(value) {
        const parts = String(value || '').split('|').map(part => part.trim());
        if (parts.length >= 2) {
            return {
                tag: parts.shift(),
                note: parts.join(' | '),
            };
        }

        return {
            tag: '',
            note: value,
        };
    }

    function parseChapterInput() {
        const textarea = document.getElementById(`${extensionId}-chapters`);
        const value = textarea instanceof HTMLTextAreaElement ? textarea.value.trim() : '';
        if (!value) {
            return [];
        }

        const ranges = [];
        const lines = value.split(/\r?\n|;/).map(line => line.trim()).filter(Boolean);

        for (const line of lines) {
            const parts = splitConfigLine(line);
            const match = parts.left.match(/^#?\s*(\d+)\s*(?:-|~|\u5230|\u81f3)\s*#?\s*(\d+)$/);
            if (!match) {
                throw new Error(`\u76ee\u5f55\u8303\u56f4\u65e0\u6548\uff1a${line}`);
            }

            const start = Number(match[1]);
            const end = Number(match[2]);
            if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
                throw new Error(`\u76ee\u5f55\u8303\u56f4\u8d77\u6b62\u65e0\u6548\uff1a${line}`);
            }

            ranges.push({
                start,
                end,
                title: parts.right || unnamedChapterTitle,
            });
        }

        ranges.sort((a, b) => a.start - b.start || a.end - b.end);
        for (let i = 1; i < ranges.length; i++) {
            if (ranges[i].start <= ranges[i - 1].end) {
                throw new Error(`\u76ee\u5f55\u8303\u56f4\u4e0d\u80fd\u91cd\u53e0\uff1a#${ranges[i - 1].start}-#${ranges[i - 1].end} \u4e0e #${ranges[i].start}-#${ranges[i].end}`);
            }
        }

        return ranges;
    }

    function splitConfigLine(line) {
        const pipeIndex = line.indexOf('|');
        if (pipeIndex !== -1) {
            return {
                left: line.slice(0, pipeIndex).trim(),
                right: line.slice(pipeIndex + 1).trim(),
            };
        }

        return {
            left: line.trim(),
            right: '',
        };
    }

    function parseFloorList(value) {
        return value
            .split(',')
            .map(item => item.trim().replace(/^#/, ''))
            .filter(Boolean)
            .map(Number)
            .filter(Number.isInteger);
    }

    function validateFavorites(favorites, exportedFloors) {
        const floorSet = new Set(exportedFloors);
        const missing = favorites.filter(favorite => !floorSet.has(favorite.floor)).map(favorite => favorite.floor);

        if (missing.length) {
            throw new Error(`\u6536\u85cf\u697c\u5c42\u4e0d\u5728\u5f53\u524d\u5bfc\u51fa\u8303\u56f4\uff1a${missing.map(floor => `#${floor}`).join(', ')}`);
        }
    }

    function buildChapterPlan(exportedFloors, userRanges) {
        const floors = Array.from(new Set(exportedFloors)).sort((a, b) => a - b);
        const floorSet = new Set(floors);

        for (const range of userRanges) {
            const hasAnyFloor = floors.some(floor => floor >= range.start && floor <= range.end);
            if (!hasAnyFloor) {
                throw new Error(`\u76ee\u5f55\u8303\u56f4\u4e0d\u5728\u5f53\u524d\u5bfc\u51fa\u8303\u56f4\uff1a#${range.start}-#${range.end}`);
            }

            if (!floorSet.has(range.start) || !floorSet.has(range.end)) {
                throw new Error(`\u76ee\u5f55\u8d77\u6b62\u697c\u5c42\u5fc5\u987b\u5df2\u6e32\u67d3\u5e76\u88ab\u5bfc\u51fa\uff1a#${range.start}-#${range.end}`);
            }
        }

        const chapters = [];
        let current = null;

        for (const floor of floors) {
            const namedRange = userRanges.find(range => floor >= range.start && floor <= range.end);
            const key = namedRange ? `${namedRange.start}-${namedRange.end}` : 'unnamed';
            const title = namedRange ? namedRange.title : unnamedChapterTitle;
            const named = Boolean(namedRange);

            if (!current || current.key !== key) {
                current = {
                    key,
                    title,
                    named,
                    start: floor,
                    end: floor,
                    floors: [],
                };
                chapters.push(current);
            }

            current.end = floor;
            current.floors.push(floor);
        }

        return chapters;
    }

    function buildReaderData(exportedFloors, favorites, chapterPlan) {
        const floors = Array.from(new Set(exportedFloors)).sort((a, b) => a - b);

        return {
            version: 1,
            floors,
            favorites: favorites.map(favorite => ({
                floor: favorite.floor,
                tag: favorite.tag || '',
                note: favorite.note || '',
            })),
            chapters: chapterPlan.map(chapter => ({
                start: chapter.start,
                end: chapter.end,
                title: chapter.title || unnamedChapterTitle,
            })),
        };
    }

    function buildExportRoot(messages, chapterPlan, exportOptions) {
        const root = document.createElement('div');
        root.id = 'html-chat-export-shell';
        root.className = 'html-chat-export-shell';

        root.appendChild(buildExportNav());
        root.appendChild(buildScrollProgress());

        const main = document.createElement('main');
        main.id = 'chat';
        main.className = ['html-chat-export', document.querySelector('#chat')?.className || ''].join(' ').trim();
        if (exportOptions.indentParagraphs) {
            main.classList.add('html-chat-export-indent-paragraphs');
        }

        const messagesByFloor = new Map();
        for (const message of messages) {
            const floor = getMessageFloor(message);
            if (Number.isInteger(floor)) {
                messagesByFloor.set(floor, message);
            }
        }

        for (let index = 0; index < chapterPlan.length; index++) {
            const chapter = chapterPlan[index];
            const section = document.createElement('section');
            section.className = 'export-chapter';
            section.id = `chapter-${index}`;
            section.dataset.chapterIndex = String(index);
            section.dataset.start = String(chapter.start);
            section.dataset.end = String(chapter.end);

            const header = document.createElement('button');
            header.type = 'button';
            header.className = 'export-chapter-title';
            header.dataset.chapterToggle = String(index);
            header.innerHTML = `<span>${escapeHtml(chapter.title)}</span><small>#${chapter.start}-#${chapter.end}</small>`;
            section.appendChild(header);

            const body = document.createElement('div');
            body.className = 'export-chapter-body';

            for (const floor of chapter.floors) {
                const source = messagesByFloor.get(floor);
                if (!source) {
                    continue;
                }

                body.appendChild(buildReaderMessage(source, floor, exportOptions));
            }

            section.appendChild(body);
            main.appendChild(section);
        }

        root.appendChild(main);
        return root;
    }

    function buildScrollProgress() {
        const progress = document.createElement('div');
        progress.className = 'export-scrollbar';
        progress.innerHTML = '<div class="export-scrollbar-thumb" data-scrollbar-thumb></div>';
        return progress;
    }

    function buildReaderMessage(source, floor, exportOptions) {
        const renderedMessage = exportOptions.copyPageStyles
            ? buildRenderedReaderMessage(source, floor, exportOptions)
            : null;
        if (renderedMessage) {
            return renderedMessage;
        }

        return buildNormalizedReaderMessage(source, floor, exportOptions);
    }

    function buildRenderedReaderMessage(source, floor, exportOptions) {
        if (!(source instanceof HTMLElement)) {
            return null;
        }

        const clone = source.cloneNode(true);
        if (!(clone instanceof HTMLElement)) {
            return null;
        }

        snapshotChildFrames(source, clone);
        clone.className = cleanExportClassName(clone.className);
        clone.classList.add('export-reader-message', 'export-reader-source-message');
        clone.classList.remove(selectedClass);
        clone.id = `mes-${floor}`;
        clone.dataset.exportFloor = String(floor);
        clone.setAttribute('mesid', String(floor));

        const cloneContent = getSourceMessageContent(clone);
        if (cloneContent instanceof HTMLElement) {
            cloneContent.classList.add('export-reader-content-inner', 'export-reader-source-content');
        }

        if (!exportOptions.includeOutsideStatus) {
            removeOutsideRenderedBlocks(source, clone);
        }

        appendMessageDataMedia(floor, cloneContent instanceof HTMLElement ? cloneContent : clone, clone);
        return clone;
    }

    function removeOutsideRenderedBlocks(source, clone) {
        const sourceContent = getSourceMessageContent(source);
        if (!(sourceContent instanceof HTMLElement)) {
            return;
        }

        const outsideBlocks = collectOutsideRenderedBlocks(source, sourceContent);
        for (const block of outsideBlocks) {
            const cloneBlock = getClonedElementBySourcePath(source, clone, block);
            if (cloneBlock instanceof HTMLElement) {
                cloneBlock.remove();
            }
        }
    }

    function getClonedElementBySourcePath(sourceRoot, cloneRoot, sourceElement) {
        const path = getElementPath(sourceRoot, sourceElement);
        if (!path) {
            return null;
        }

        let current = cloneRoot;
        for (const index of path) {
            current = current?.children?.[index];
            if (!(current instanceof HTMLElement)) {
                return null;
            }
        }

        return current;
    }

    function getElementPath(root, element) {
        const path = [];
        let current = element;

        while (current && current !== root) {
            const parent = current.parentElement;
            if (!parent) {
                return null;
            }

            path.unshift(Array.prototype.indexOf.call(parent.children, current));
            current = parent;
        }

        return current === root ? path : null;
    }

    function buildNormalizedReaderMessage(source, floor, exportOptions) {
        const includeChrome = exportOptions.preserveMessageChrome;
        const article = document.createElement('article');
        article.className = includeChrome
            ? 'mes export-reader-message export-reader-normalized-message export-reader-message-with-chrome'
            : 'mes export-reader-message export-reader-normalized-message';
        article.id = `mes-${floor}`;
        article.dataset.exportFloor = String(floor);
        article.setAttribute('mesid', String(floor));

        const header = document.createElement('div');
        header.className = 'export-reader-floor';
        header.textContent = `#${floor}`;
        article.appendChild(header);

        if (includeChrome) {
            const chrome = buildNormalizedMessageChrome(source);
            if (chrome) {
                article.appendChild(chrome);
            }
        }

        const content = document.createElement('div');
        content.className = 'export-reader-content';

        const sourceContent = getSourceMessageContent(source);
        const outsideBlocks = exportOptions.includeOutsideStatus && sourceContent
            ? collectOutsideRenderedBlocks(source, sourceContent)
            : [];
        if (sourceContent) {
            const contentClone = sourceContent.cloneNode(true);
            contentClone.classList.add('export-reader-content-inner');
            content.appendChild(contentClone);
            if (outsideBlocks.length) {
                appendOutsideRenderedBlocks(outsideBlocks, content);
                removeRenderedHtmlSourceBlocks(contentClone);
            }
        } else {
            content.textContent = source.textContent || '';
        }

        appendDetachedContentMedia(source, sourceContent, content, outsideBlocks);
        appendMessageDataMedia(floor, content);
        article.appendChild(content);
        return article;
    }

    function buildNormalizedMessageChrome(source) {
        const chrome = document.createElement('div');
        chrome.className = 'export-message-chrome';

        const avatar = source.querySelector('.mesAvatarWrapper .avatar img, .avatar img');
        if (avatar instanceof HTMLImageElement) {
            const wrapper = document.createElement('div');
            wrapper.className = 'export-message-avatar';
            wrapper.appendChild(avatar.cloneNode(true));
            chrome.appendChild(wrapper);
        }

        const meta = document.createElement('div');
        meta.className = 'export-message-meta';

        const name = getFirstText(source, ['.ch_name .name_text', '.name_text']);
        if (name) {
            const nameElement = document.createElement('div');
            nameElement.className = 'export-message-name';
            nameElement.textContent = name;
            meta.appendChild(nameElement);
        }

        const details = [
            getFirstText(source, ['.mes_timer', '.timestamp']),
            getFirstText(source, ['.tokenCounterDisplay']),
        ].filter(Boolean);

        if (details.length) {
            const detailsElement = document.createElement('div');
            detailsElement.className = 'export-message-details';
            detailsElement.textContent = details.join(' | ');
            meta.appendChild(detailsElement);
        }

        if (meta.childNodes.length) {
            chrome.appendChild(meta);
        }

        return chrome.childNodes.length ? chrome : null;
    }

    function getFirstText(root, selectors) {
        for (const selector of selectors) {
            const element = root.querySelector(selector);
            const text = element?.textContent?.replace(/\s+/g, ' ').trim();
            if (text) {
                return text;
            }
        }

        return '';
    }

    function getSourceMessageContent(message) {
        return message.querySelector('.mes_text')
            || message.querySelector('.message-content')
            || message.querySelector('.message_text')
            || message.querySelector('[data-message-content]');
    }

    function appendDetachedContentMedia(source, sourceContent, target, outsideBlocks = []) {
        const sourceContentContains = element => sourceContent && sourceContent.contains(element);
        const media = Array.from(source.querySelectorAll('img, video, audio')).filter(element => {
            if (sourceContentContains(element)) {
                return false;
            }

            if (outsideBlocks.some(block => block.contains(element))) {
                return false;
            }

            return !element.closest('.avatar, .mesAvatarWrapper, .ch_name, .mes_buttons, .extraMesButtons, .swipe_left, .swipe_right');
        });

        for (const element of media) {
            target.appendChild(element.cloneNode(true));
        }
    }

    function appendMessageDataMedia(floor, target, existingRoot = target) {
        const message = tavernChat[floor];
        const media = getMessageDataMediaForExport(message);
        if (!media.length) {
            return;
        }

        const existingUrls = collectExistingMediaUrls(existingRoot);
        const wrapper = document.createElement('div');
        wrapper.className = 'export-reader-content-inner export-reader-data-media mes_media_wrapper';

        for (const attachment of media) {
            const url = getAttachmentUrl(attachment);
            if (!url || mediaUrlExists(existingUrls, url)) {
                continue;
            }

            const element = createMessageDataMediaElement(attachment);
            if (element) {
                wrapper.appendChild(element);
            }
        }

        if (wrapper.childNodes.length) {
            target.appendChild(wrapper);
        }
    }

    function getMessageDataMediaForExport(message) {
        const media = Array.isArray(message?.extra?.media) ? message.extra.media : [];
        if (!media.length) {
            return [];
        }

        if (getMediaDisplay(message) === 'gallery') {
            const selected = media[getMediaIndex(message)];
            return selected ? [selected] : [];
        }

        return media;
    }

    function collectExistingMediaUrls(root) {
        const urls = new Set();
        for (const element of root.querySelectorAll('img[src], source[src], video[src], audio[src], video[poster]')) {
            for (const attribute of ['src', 'poster']) {
                addMediaUrl(urls, element.getAttribute(attribute));
            }

            if (element instanceof HTMLMediaElement || element instanceof HTMLImageElement) {
                addMediaUrl(urls, element.currentSrc);
            }
        }

        return urls;
    }

    function addMediaUrl(urls, value) {
        if (!value) {
            return;
        }

        urls.add(value);
        try {
            urls.add(new URL(value, location.href).href);
        } catch {
            // Keep the raw value above; malformed custom URLs can still be compared literally.
        }
    }

    function mediaUrlExists(urls, value) {
        if (urls.has(value)) {
            return true;
        }

        try {
            return urls.has(new URL(value, location.href).href);
        } catch {
            return false;
        }
    }

    function createMessageDataMediaElement(attachment) {
        const url = getAttachmentUrl(attachment);
        if (!url) {
            return null;
        }

        const type = String(attachment?.type || 'image').toLowerCase();
        if (type === 'video') {
            return createMessageDataVideoElement(attachment, url);
        }

        if (type === 'audio') {
            return createMessageDataAudioElement(attachment, url);
        }

        return createMessageDataImageElement(attachment, url);
    }

    function createMessageDataImageElement(attachment, url) {
        const container = document.createElement('div');
        container.className = 'mes_media_container mes_img_container export-reader-data-media-item';

        const image = document.createElement('img');
        image.className = 'mes_img';
        image.setAttribute('src', url);
        image.setAttribute('alt', '');
        applyAttachmentTitle(image, attachment);
        container.appendChild(image);

        return container;
    }

    function createMessageDataVideoElement(attachment, url) {
        const container = document.createElement('div');
        container.className = 'mes_media_container mes_video_container export-reader-data-media-item';

        const video = document.createElement('video');
        video.className = 'mes_video';
        video.controls = true;
        video.preload = 'metadata';
        video.setAttribute('src', url);
        applyAttachmentTitle(video, attachment);
        container.appendChild(video);

        return container;
    }

    function createMessageDataAudioElement(attachment, url) {
        const container = document.createElement('div');
        container.className = 'mes_media_container mes_audio_container export-reader-data-media-item';

        const audio = document.createElement('audio');
        audio.className = 'mes_audio';
        audio.controls = true;
        audio.preload = 'metadata';
        audio.setAttribute('src', url);
        applyAttachmentTitle(audio, attachment);
        container.appendChild(audio);

        return container;
    }

    function applyAttachmentTitle(element, attachment) {
        const title = typeof attachment?.title === 'string' ? attachment.title : '';
        if (title) {
            element.setAttribute('title', title);
        }
    }

    function getAttachmentUrl(attachment) {
        return typeof attachment?.url === 'string' ? attachment.url : '';
    }

    function appendOutsideRenderedBlocks(blocks, target) {
        const outside = document.createElement('div');
        outside.className = 'export-reader-content-inner export-reader-outside-content';
        for (const block of blocks) {
            const clone = cloneRenderedBlock(block);
            if (clone) {
                outside.appendChild(clone);
            }
        }

        if (!outside.childNodes.length) {
            return;
        }

        target.appendChild(outside);
    }

    function collectOutsideRenderedBlocks(source, sourceContent) {
        const candidates = [];
        const seen = new Set();
        const regions = getOutsideContentRegions(source, sourceContent);

        for (const region of regions) {
            for (const child of Array.from(region.children)) {
                if (isExportableOutsideBlock(child, sourceContent) && !seen.has(child)) {
                    seen.add(child);
                    candidates.push(child);
                }
            }
        }

        return candidates;
    }

    function getOutsideContentRegions(source, sourceContent) {
        const regions = new Set();
        if (sourceContent?.parentElement) {
            regions.add(sourceContent.parentElement);
        }

        const messageBlock = sourceContent?.closest('.mes_block');
        if (messageBlock instanceof HTMLElement) {
            regions.add(messageBlock);
        }

        regions.add(source);
        return Array.from(regions).filter(region => region instanceof HTMLElement);
    }

    function isExportableOutsideBlock(element, sourceContent) {
        if (!(element instanceof HTMLElement)) {
            return false;
        }

        if (element === sourceContent || element.contains(sourceContent) || sourceContent?.contains(element)) {
            return false;
        }

        if (isMessageChromeOrControl(element)) {
            return false;
        }

        if (!isVisibleRenderedBlock(element)) {
            return false;
        }

        return Boolean(element.textContent?.trim())
            || element.matches('img, video, audio, canvas, svg, iframe, object, embed')
            || Boolean(element.querySelector('img, video, audio, canvas, svg, iframe, object, embed'));
    }

    function isMessageChromeOrControl(element) {
        return Boolean(element.closest([
            '.avatar',
            '.mesAvatarWrapper',
            '.ch_name',
            '.name_text',
            '.mes_buttons',
            '.extraMesButtons',
            '.swipe_left',
            '.swipe_right',
            '.swipe_counter',
            '.mes_edit_buttons',
            '.del_checkbox',
            `.${checkboxClass}`,
        ].join(', ')));
    }

    function isVisibleRenderedBlock(element) {
        const computed = window.getComputedStyle(element);
        if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
            return false;
        }

        return element.getClientRects().length > 0
            || Boolean(element.querySelector('iframe, canvas, svg, img, video, audio'));
    }

    function cloneRenderedBlock(element) {
        const clone = element.cloneNode(true);
        if (!(clone instanceof HTMLElement)) {
            return null;
        }

        snapshotChildFrames(element, clone);
        return clone;
    }

    function snapshotChildFrames(sourceRoot, cloneRoot) {
        const sourceFrames = sourceRoot.matches('iframe')
            ? [sourceRoot]
            : Array.from(sourceRoot.querySelectorAll('iframe'));
        const cloneFrames = cloneRoot.matches('iframe')
            ? [cloneRoot]
            : Array.from(cloneRoot.querySelectorAll('iframe'));

        const count = Math.min(sourceFrames.length, cloneFrames.length);
        for (let i = 0; i < count; i++) {
            snapshotFrame(sourceFrames[i], cloneFrames[i]);
        }
    }

    function snapshotFrame(sourceFrame, cloneFrame) {
        if (!(sourceFrame instanceof HTMLIFrameElement) || !(cloneFrame instanceof HTMLIFrameElement)) {
            return;
        }

        try {
            const sourceDocument = sourceFrame.contentDocument;
            if (!sourceDocument?.documentElement) {
                return;
            }

            const documentClone = sourceDocument.documentElement.cloneNode(true);
            sanitizeSnapshotRoot(documentClone);
            prepareSnapshotFrameInteractions(sourceDocument, documentClone);
            cloneFrame.setAttribute('srcdoc', `${serializeDoctype(sourceDocument)}\n${documentClone.outerHTML}`);
            cloneFrame.removeAttribute('src');
            cloneFrame.removeAttribute('loading');
            preserveFrameHeight(sourceFrame, cloneFrame);
        } catch (error) {
            console.warn('[拾玉-HTML导出] failed to snapshot outside frame:', error);
        }
    }

    function serializeDoctype(sourceDocument) {
        const doctype = sourceDocument.doctype;
        if (!doctype) {
            return '<!doctype html>';
        }

        const publicId = doctype.publicId ? ` PUBLIC "${doctype.publicId}"` : '';
        const systemId = doctype.systemId ? `${doctype.publicId ? '' : ' SYSTEM'} "${doctype.systemId}"` : '';
        return `<!doctype ${doctype.name}${publicId}${systemId}>`;
    }

    function sanitizeSnapshotRoot(root) {
        let changed = false;

        root.querySelectorAll('script, noscript').forEach(element => {
            element.remove();
            changed = true;
        });
        root.querySelectorAll('*').forEach(element => {
            for (const attribute of Array.from(element.attributes)) {
                if (attribute.name.startsWith('on')) {
                    element.removeAttribute(attribute.name);
                    changed = true;
                }
            }
        });

        return changed;
    }

    function prepareSnapshotFrameInteractions(sourceDocument, documentClone) {
        const sourceHeaders = Array.from(sourceDocument.querySelectorAll('.panel > .hdr'));
        const cloneHeaders = Array.from(documentClone.querySelectorAll('.panel > .hdr'));
        const count = Math.min(sourceHeaders.length, cloneHeaders.length);

        for (let i = 0; i < count; i++) {
            const sourceHeader = sourceHeaders[i];
            const cloneHeader = cloneHeaders[i];
            const sourceContent = sourceHeader.nextElementSibling;
            const cloneContent = cloneHeader.nextElementSibling;
            if (!sourceContent?.classList.contains('bdy') || !cloneContent?.classList.contains('bdy')) {
                continue;
            }

            const contentId = cloneContent.id || `export-frame-collapse-${i}`;
            const expanded = sourceContent.classList.contains('open');
            cloneContent.id = contentId;
            cloneContent.dataset.exportFrameCollapseContent = '';
            cloneHeader.dataset.exportFrameCollapseToggle = '';
            cloneHeader.setAttribute('aria-controls', contentId);
            cloneHeader.setAttribute('aria-expanded', String(expanded));
            cloneHeader.setAttribute('role', 'button');
            if (!cloneHeader.hasAttribute('tabindex')) {
                cloneHeader.setAttribute('tabindex', '0');
            }
        }
    }

    function preserveFrameHeight(sourceFrame, cloneFrame) {
        if (cloneFrame.style.getPropertyValue('height')) {
            return;
        }

        const rect = sourceFrame.getBoundingClientRect();
        if (rect.height > 0) {
            cloneFrame.style.height = `${Math.ceil(rect.height)}px`;
        }
    }

    function removeRenderedHtmlSourceBlocks(contentRoot) {
        contentRoot.querySelectorAll('code.custom-html, code.custom-language-html').forEach(code => {
            const text = code.textContent || '';
            if (!looksLikeRenderedHtmlSource(text)) {
                return;
            }

            const block = code.closest('pre') || code;
            block.remove();
        });
    }

    function looksLikeRenderedHtmlSource(text) {
        return /<!doctype html|<html[\s>]|<body[\s>]|<script[\s>]|<template[\s>]/i.test(text);
    }

    function buildExportNav() {
        const nav = document.createElement('aside');
        nav.className = 'export-nav';
        nav.innerHTML = `
            <button class="export-nav-toggle" type="button" aria-expanded="false" aria-controls="export-nav-panel">\u5bfc\u822a</button>
            <div class="export-nav-panel" id="export-nav-panel">
            <div class="export-nav-actions">
                <button class="export-nav-action export-nav-icon-action" type="button" data-editor-toggle aria-label="\u7f16\u8f91" title="\u7f16\u8f91">\u270e</button>
                <button class="export-nav-action export-nav-icon-action" type="button" data-search-toggle aria-label="\u641c\u7d22" title="\u641c\u7d22"><span class="export-search-icon" aria-hidden="true"></span></button>
                <button class="export-nav-action export-nav-icon-action" type="button" data-font-cycle aria-label="\u5b57\u4f53\u5927\u5c0f" title="\u5b57\u4f53\u5927\u5c0f">\u5b57</button>
                <button class="export-nav-action" type="button" data-save-copy title="\u4e0b\u8f7d\u4e00\u4efd\u5199\u5165\u5f53\u524d\u6536\u85cf\u548c\u76ee\u5f55\u7684 HTML">\u4e0b\u8f7d\u4fdd\u5b58HTML</button>
            </div>
            <section class="export-search" hidden>
                <label for="export-search-input">\u641c\u7d22\u9875\u9762\u5185\u5bb9</label>
                <div class="export-search-row">
                    <input id="export-search-input" class="export-search-input" data-search-input type="search" autocomplete="off">
                    <button class="export-nav-action export-nav-icon-action" type="button" data-search-prev aria-label="\u4e0a\u4e00\u4e2a" title="\u4e0a\u4e00\u4e2a">\u2191</button>
                    <button class="export-nav-action export-nav-icon-action" type="button" data-search-next aria-label="\u4e0b\u4e00\u4e2a" title="\u4e0b\u4e00\u4e2a">\u2193</button>
                </div>
                <p class="export-search-status" data-search-status></p>
            </section>
            <details class="export-nav-group export-favorites" open>
                <summary>\u6536\u85cf</summary>
                <div class="export-favorites-content"></div>
            </details>
            <details class="export-nav-group export-directory" open>
                <summary>\u76ee\u5f55</summary>
                <ol class="export-nav-list export-directory-list"></ol>
            </details>
            <section class="export-editor" hidden>
                <label for="export-favorites-editor">\u6536\u85cf\u2665\u6807\u7b7e</label>
                <textarea id="export-favorites-editor" class="export-editor-textarea" data-favorites-editor spellcheck="false" placeholder="#50 | \u6807\u7b7e | \u5907\u6ce8"></textarea>
                <button class="export-nav-action" type="button" data-apply-favorites>\u5e94\u7528\u5230\u5f53\u524d\u9875</button>
                <label for="export-chapters-editor">\u76ee\u5f55\u7ae0\u8282</label>
                <textarea id="export-chapters-editor" class="export-editor-textarea" data-chapters-editor spellcheck="false" placeholder="50-100 | \u7ae0\u8282\u540d"></textarea>
                <button class="export-nav-action" type="button" data-apply-chapters>\u5e94\u7528\u5230\u5f53\u524d\u9875</button>
                <p class="export-editor-status" data-editor-status></p>
            </section>
            </div>
            <div class="export-favorite-picker" data-favorite-picker hidden>
                <div class="export-favorite-picker-panel">
                    <h2>\u6536\u85cf #<span data-favorite-picker-floor></span></h2>
                    <label for="export-favorite-tag-select">\u9009\u62e9\u5df2\u6709\u6807\u7b7e</label>
                    <select id="export-favorite-tag-select" data-favorite-tag-select></select>
                    <label for="export-favorite-new-tag">\u65b0\u6807\u7b7e</label>
                    <input id="export-favorite-new-tag" data-favorite-new-tag type="text" placeholder="\u7559\u7a7a\u4e3a\u65e0\u6807\u7b7e">
                    <label for="export-favorite-note">\u5907\u6ce8</label>
                    <input id="export-favorite-note" data-favorite-note type="text" placeholder="\u53ef\u7559\u7a7a">
                    <div class="export-favorite-picker-actions">
                        <button class="export-nav-action" type="button" data-favorite-picker-cancel>\u53d6\u6d88</button>
                        <button class="export-nav-action" type="button" data-favorite-picker-confirm>\u786e\u8ba4\u6536\u85cf</button>
                    </div>
                </div>
            </div>
        `;

        return nav;
    }

    function removeUnwantedControls(root) {
        for (const selector of controlSelectors) {
            root.querySelectorAll(selector).forEach(element => element.remove());
        }

        root.querySelectorAll('script, noscript').forEach(element => element.remove());
        root.querySelectorAll('*').forEach(element => {
            for (const attribute of Array.from(element.attributes)) {
                if (attribute.name.startsWith('on')) {
                    element.removeAttribute(attribute.name);
                }
            }
        });
    }

    async function applyMessageStyleSnapshots(sourceMessages, exportRoot, exportTask) {
        for (let i = 0; i < sourceMessages.length; i++) {
            throwIfExportCancelled(exportTask);

            const source = sourceMessages[i];
            const floor = getMessageFloor(source);
            if (!Number.isInteger(floor)) {
                continue;
            }

            const clone = exportRoot.querySelector(`[data-export-floor="${floor}"]`);
            if (!(clone instanceof HTMLElement)) {
                continue;
            }

            const sourceContent = getSourceMessageContent(source);
            const cloneContent = clone.querySelector('.export-reader-content-inner');
            if (sourceContent instanceof HTMLElement && cloneContent instanceof HTMLElement) {
                applyComputedStyleSnapshot(sourceContent, cloneContent, exportTask);
            }

            if (i % 5 === 0) {
                setStatus(`\u6b63\u5728\u5199\u5165\u804a\u5929\u533a\u6837\u5f0f\u5feb\u7167 ${i + 1}/${sourceMessages.length}...`);
                await nextFrame();
                throwIfExportCancelled(exportTask);
            }
        }

    }

    function applyComputedStyleSnapshot(sourceRoot, cloneRoot, exportTask) {
        const sourceElements = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
        const cloneElements = [cloneRoot, ...cloneRoot.querySelectorAll('*')];
        const count = Math.min(sourceElements.length, cloneElements.length);
        for (let i = 0; i < count; i++) {
            throwIfExportCancelled(exportTask);

            const source = sourceElements[i];
            const clone = cloneElements[i];
            if (!(source instanceof HTMLElement) || !(clone instanceof HTMLElement)) {
                continue;
            }

            const computed = window.getComputedStyle(source);
            const styles = {};

            for (const property of computedStyleProperties) {
                let value = computed.getPropertyValue(property);
                if (!value) {
                    continue;
                }

                styles[property] = value;
            }

            if (source !== sourceRoot && isScrollableSnapshotElement(source, computed)) {
                for (const property of scrollBoxStyleProperties) {
                    const value = computed.getPropertyValue(property);
                    if (value) {
                        styles[property] = value;
                    }
                }
            }

            clone.setAttribute('style', [clone.getAttribute('style') || '', styleObjectToCss(styles)].filter(Boolean).join('\n'));
        }

    }

    function isScrollableSnapshotElement(element, computed) {
        if (!(element instanceof HTMLElement)) {
            return false;
        }

        const overflowY = computed.getPropertyValue('overflow-y');
        const overflowX = computed.getPropertyValue('overflow-x');
        const scrollsY = /auto|scroll|overlay/i.test(overflowY) && element.scrollHeight > element.clientHeight + 4;
        const scrollsX = /auto|scroll|overlay/i.test(overflowX) && element.scrollWidth > element.clientWidth + 4;
        return scrollsY || scrollsX;
    }

    function normalizeExportDom(root) {
        root.querySelectorAll('.mes').forEach(message => {
            message.style.display = '';
            message.style.visibility = '';
        });

        root.querySelectorAll('details').forEach(details => {
            if (details.hasAttribute('open')) {
                details.setAttribute('open', '');
            }
        });
    }

    async function inlineElementAssets(root, exportTask) {
        const elements = Array.from(root.querySelectorAll('img[src], source[src], video[src], audio[src]'));
        const cache = getExportAssetCache(exportTask);
        let failed = 0;

        await mapWithConcurrency(elements, assetFetchConcurrency, async (element, i) => {
            throwIfExportCancelled(exportTask);

            const src = element.getAttribute('src');
            setStatus(`\u6b63\u5728\u5185\u5d4c\u8d44\u6e90 ${i + 1}/${elements.length}...`);

            if (!src || src.startsWith('data:')) {
                return;
            }

            try {
                const absoluteUrl = new URL(src, location.href).href;
                const dataUrl = await getAssetDataUrl(absoluteUrl, cache, exportTask);
                element.setAttribute('src', dataUrl);
                element.removeAttribute('srcset');
                element.removeAttribute('loading');
            } catch (error) {
                if (isExportCancelled(error, exportTask)) {
                    throw error;
                }

                failed++;
                console.warn('[拾玉-HTML导出] failed to inline asset:', src, error);
            }

        });

        const styleTargets = Array.from(root.querySelectorAll('[style*="url("]'));
        await mapWithConcurrency(styleTargets, assetFetchConcurrency, async element => {
            const style = element.getAttribute('style') || '';
            const result = await inlineCssUrls(style, cache, location.href, exportTask);
            failed += result.failed;
            if (result.cssText !== style) {
                element.setAttribute('style', result.cssText);
            }
        });

        failed += await inlineFrameSrcdocAssets(root, cache, exportTask);

        if (failed > 0) {
            notify(`${failed} \u4e2a\u8d44\u6e90\u672a\u80fd\u5185\u5d4c\uff0cHTML\u4e2d\u4f1a\u4fdd\u7559\u539f\u94fe\u63a5\u3002`, 'warning');
        }
    }

    async function inlineFrameSrcdocAssets(root, cache, exportTask) {
        const frames = Array.from(root.querySelectorAll('iframe[srcdoc]'));
        let failed = 0;

        await mapWithConcurrency(frames, assetFetchConcurrency, async (frame, i) => {
            throwIfExportCancelled(exportTask);

            const srcdoc = frame.getAttribute('srcdoc');
            if (!srcdoc) {
                return;
            }

            setStatus(`\u6b63\u5728\u5185\u5d4c\u5916\u7f6e\u9884\u89c8\u8d44\u6e90 ${i + 1}/${frames.length}...`);
            const documentSnapshot = new DOMParser().parseFromString(srcdoc, 'text/html');
            const sanitized = sanitizeSnapshotRoot(documentSnapshot.documentElement);
            const result = await inlineDocumentSnapshotAssets(documentSnapshot, cache, location.href, exportTask);
            failed += result.failed;
            if (sanitized || result.changed) {
                frame.setAttribute('srcdoc', `<!doctype html>\n${documentSnapshot.documentElement.outerHTML}`);
            }

        });

        return failed;
    }

    async function inlineDocumentSnapshotAssets(documentSnapshot, cache, baseUrl, exportTask) {
        let changed = false;
        let failed = 0;
        const elements = Array.from(documentSnapshot.querySelectorAll('img[src], source[src], video[src], audio[src], video[poster]'));

        await mapWithConcurrency(elements, assetFetchConcurrency, async element => {
            throwIfExportCancelled(exportTask);

            for (const attribute of ['src', 'poster']) {
                const value = element.getAttribute(attribute);
                if (!value || value.startsWith('data:')) {
                    continue;
                }

                try {
                    const absoluteUrl = new URL(value, baseUrl).href;
                    const dataUrl = await getAssetDataUrl(absoluteUrl, cache, exportTask);
                    throwIfExportCancelled(exportTask);
                    element.setAttribute(attribute, dataUrl);
                    if (attribute === 'src') {
                        element.removeAttribute('srcset');
                        element.removeAttribute('loading');
                    }
                    changed = true;
                } catch (error) {
                    if (isExportCancelled(error, exportTask)) {
                        throw error;
                    }

                    failed++;
                    console.warn('[拾玉-HTML导出] failed to inline frame asset:', value, error);
                }
            }
        });

        for (const styleElement of documentSnapshot.querySelectorAll('style')) {
            const css = styleElement.textContent || '';
            if (!css.includes('url(')) {
                continue;
            }

            const result = await inlineCssUrls(css, cache, baseUrl, exportTask);
            failed += result.failed;
            if (result.cssText !== css) {
                styleElement.textContent = result.cssText;
                changed = true;
            }
        }

        for (const element of documentSnapshot.querySelectorAll('[style*="url("]')) {
            const style = element.getAttribute('style') || '';
            const result = await inlineCssUrls(style, cache, baseUrl, exportTask);
            failed += result.failed;
            if (result.cssText !== style) {
                element.setAttribute('style', result.cssText);
                changed = true;
            }
        }

        return { changed, failed };
    }

    function dedupeEmbeddedAssets(root) {
        const rootReferences = collectElementDataUrlReferences(root);
        const frameSnapshots = [];
        const counts = new Map();

        for (const reference of rootReferences) {
            counts.set(reference.value, (counts.get(reference.value) || 0) + 1);
        }

        for (const frame of root.querySelectorAll('iframe[srcdoc]')) {
            const srcdoc = frame.getAttribute('srcdoc');
            if (!srcdoc) {
                continue;
            }

            const documentSnapshot = new DOMParser().parseFromString(srcdoc, 'text/html');
            const elementReferences = collectElementDataUrlReferences(documentSnapshot);
            const cssValues = [];
            for (const styleElement of documentSnapshot.querySelectorAll('style')) {
                cssValues.push(styleElement.textContent || '');
            }
            for (const element of documentSnapshot.querySelectorAll('[style*="data:"]')) {
                cssValues.push(element.getAttribute('style') || '');
            }

            for (const reference of elementReferences) {
                counts.set(reference.value, (counts.get(reference.value) || 0) + 1);
            }
            for (const css of cssValues) {
                for (const value of extractEmbeddedCssDataUrls(css)) {
                    counts.set(value, (counts.get(value) || 0) + 1);
                }
            }
            frameSnapshots.push({ frame, documentSnapshot });
        }

        const assetMap = {};
        const ids = new Map();
        for (const [value, count] of counts) {
            if (count < 2) {
                continue;
            }
            const id = `asset-${ids.size}`;
            ids.set(value, id);
            assetMap[id] = value;
        }

        for (const reference of rootReferences) {
            const id = ids.get(reference.value);
            if (!id) {
                continue;
            }
            reference.element.setAttribute(`data-export-${reference.attribute}-ref`, id);
            reference.element.removeAttribute(reference.attribute);
        }

        for (const { frame, documentSnapshot } of frameSnapshots) {
            let changed = false;
            for (const reference of collectElementDataUrlReferences(documentSnapshot)) {
                const id = ids.get(reference.value);
                if (!id) {
                    continue;
                }
                reference.element.setAttribute(reference.attribute, `${embeddedAssetMarkerPrefix}${id}${embeddedAssetMarkerSuffix}`);
                changed = true;
            }

            for (const styleElement of documentSnapshot.querySelectorAll('style')) {
                const css = styleElement.textContent || '';
                const replacement = replaceEmbeddedCssDataUrls(css, ids);
                if (replacement !== css) {
                    styleElement.textContent = replacement;
                    changed = true;
                }
            }

            for (const element of documentSnapshot.querySelectorAll('[style*="data:"]')) {
                const style = element.getAttribute('style') || '';
                const replacement = replaceEmbeddedCssDataUrls(style, ids);
                if (replacement !== style) {
                    element.setAttribute('style', replacement);
                    changed = true;
                }
            }

            if (changed) {
                frame.setAttribute('data-export-srcdoc', `<!doctype html>\n${documentSnapshot.documentElement.outerHTML}`);
                frame.removeAttribute('srcdoc');
            }
        }

        return assetMap;
    }

    function collectElementDataUrlReferences(root) {
        const references = [];
        for (const element of root.querySelectorAll('img[src], source[src], video[src], audio[src], video[poster]')) {
            for (const attribute of ['src', 'poster']) {
                const value = element.getAttribute(attribute);
                if (value?.startsWith('data:') && value.length > embeddedAssetDedupeThreshold) {
                    references.push({ element, attribute, value });
                }
            }
        }
        return references;
    }

    function extractEmbeddedCssDataUrls(cssText) {
        return Array.from(cssText.matchAll(/url\(\s*(['"]?)(data:[^)'"\s]+)\1\s*\)/g))
            .map(match => match[2])
            .filter(value => value.length > embeddedAssetDedupeThreshold);
    }

    function replaceEmbeddedCssDataUrls(cssText, ids) {
        return cssText.replace(/url\(\s*(['"]?)(data:[^)'"\s]+)\1\s*\)/g, (fullMatch, quote, dataUrl) => {
            const id = ids.get(dataUrl);
            return id ? `url("${embeddedAssetMarkerPrefix}${id}${embeddedAssetMarkerSuffix}")` : fullMatch;
        });
    }

    async function compressEmbeddedImages(root, preset, cache, exportTask) {
        const targets = [];
        let changed = 0;
        let failed = 0;
        let savedBytes = 0;

        for (const element of root.querySelectorAll('img[src], video[poster]')) {
            for (const attribute of ['src', 'poster']) {
                const value = element.getAttribute(attribute);
                if (isCompressibleImageDataUrl(value)) {
                    targets.push({ element, attribute, value });
                }
            }
        }

        for (let i = 0; i < targets.length; i++) {
            throwIfExportCancelled(exportTask);

            const target = targets[i];
            setStatus(`\u6b63\u5728\u6309${preset.label}\u6863\u538b\u7f29\u56fe\u7247 ${i + 1}/${targets.length}...`);

            try {
                let compressed = cache.get(target.value);
                if (compressed === undefined) {
                    compressed = await compressImageDataUrl(target.value, preset, exportTask);
                    cache.set(target.value, compressed);
                }

                if (compressed && compressed.length < target.value.length) {
                    target.element.setAttribute(target.attribute, compressed);
                    savedBytes += Math.max(0, estimateDataUrlBytes(target.value) - estimateDataUrlBytes(compressed));
                    changed++;
                }
            } catch (error) {
                if (isExportCancelled(error, exportTask)) {
                    throw error;
                }

                failed++;
                console.warn('[拾玉-HTML导出] failed to compress image:', error);
            }

            if (i % 5 === 0) {
                await nextFrame();
                throwIfExportCancelled(exportTask);
            }
        }

        for (const frame of root.querySelectorAll('iframe[srcdoc]')) {
            throwIfExportCancelled(exportTask);
            const srcdoc = frame.getAttribute('srcdoc');
            if (!srcdoc) {
                continue;
            }

            const documentSnapshot = new DOMParser().parseFromString(srcdoc, 'text/html');
            const summary = await compressDocumentSnapshotImages(documentSnapshot, preset, cache, exportTask);
            changed += summary.changed;
            failed += summary.failed;
            savedBytes += summary.savedBytes;
            if (summary.changed > 0) {
                frame.setAttribute('srcdoc', `<!doctype html>\n${documentSnapshot.documentElement.outerHTML}`);
            }
        }

        return { changed, failed, savedBytes };
    }

    async function compressCssDataUrls(cssText, preset, cache, exportTask) {
        const matches = Array.from(new Map(
            Array.from(cssText.matchAll(/url\(\s*(['"]?)(data:image\/(?:png|jpe?g);base64,[^)'"\s]+)\1\s*\)/gi))
                .map(match => [match[2], match]),
        ).values());
        let result = cssText;
        const summary = { changed: 0, failed: 0, savedBytes: 0 };

        for (const match of matches) {
            const dataUrl = match[2];
            const targetSummary = await compressDataUrlTarget(
                dataUrl,
                compressed => {
                    result = result.split(match[0]).join(`url("${escapeCssString(compressed)}")`);
                },
                preset,
                cache,
                exportTask,
            );
            mergeCompressionSummary(summary, targetSummary);
        }

        return { cssText: result, ...summary };
    }

    async function compressDataUrlTarget(dataUrl, apply, preset, cache, exportTask) {
        try {
            let compressed = cache.get(dataUrl);
            if (compressed === undefined) {
                compressed = await compressImageDataUrl(dataUrl, preset, exportTask);
                cache.set(dataUrl, compressed);
            }
            if (!compressed || compressed.length >= dataUrl.length) {
                return { changed: 0, failed: 0, savedBytes: 0 };
            }

            apply(compressed);
            return {
                changed: 1,
                failed: 0,
                savedBytes: Math.max(0, estimateDataUrlBytes(dataUrl) - estimateDataUrlBytes(compressed)),
            };
        } catch (error) {
            if (isExportCancelled(error, exportTask)) {
                throw error;
            }
            console.warn('[拾玉-HTML导出] failed to compress image:', error);
            return { changed: 0, failed: 1, savedBytes: 0 };
        }
    }

    function mergeCompressionSummary(target, source) {
        target.changed += source.changed;
        target.failed += source.failed;
        target.savedBytes += source.savedBytes;
        return target;
    }

    function notifyImageCompressionSummary(summary, preset) {
        if (summary.changed > 0) {
            notify(`\u5df2\u6309${preset.label}\u6863\u538b\u7f29 ${summary.changed} \u5904\u56fe\u7247\uff0c\u7ea6\u51cf\u5c11 ${formatBytes(summary.savedBytes)}\u3002`);
        }
        if (summary.failed > 0) {
            notify(`${summary.failed} \u5904\u56fe\u7247\u672a\u80fd\u538b\u7f29\uff0c\u5df2\u4fdd\u7559\u539f\u56fe\u3002`, 'warning');
        }
    }

    async function compressDocumentSnapshotImages(documentSnapshot, preset, cache, exportTask) {
        const targets = [];
        let changed = 0;
        let failed = 0;
        let savedBytes = 0;

        for (const element of documentSnapshot.querySelectorAll('img[src], video[poster]')) {
            for (const attribute of ['src', 'poster']) {
                const value = element.getAttribute(attribute);
                if (isCompressibleImageDataUrl(value)) {
                    targets.push({
                        value,
                        apply: compressed => element.setAttribute(attribute, compressed),
                    });
                }
            }
        }

        for (const styleElement of documentSnapshot.querySelectorAll('style')) {
            const css = styleElement.textContent || '';
            const result = await compressCssDataUrls(css, preset, cache, exportTask);
            if (result.cssText !== css) {
                styleElement.textContent = result.cssText;
            }
            changed += result.changed;
            failed += result.failed;
            savedBytes += result.savedBytes;
        }

        for (const element of documentSnapshot.querySelectorAll('[style*="data:image/"]')) {
            const style = element.getAttribute('style') || '';
            const result = await compressCssDataUrls(style, preset, cache, exportTask);
            if (result.cssText !== style) {
                element.setAttribute('style', result.cssText);
            }
            changed += result.changed;
            failed += result.failed;
            savedBytes += result.savedBytes;
        }

        for (const target of targets) {
            const summary = await compressDataUrlTarget(target.value, target.apply, preset, cache, exportTask);
            changed += summary.changed;
            failed += summary.failed;
            savedBytes += summary.savedBytes;
        }

        return { changed, failed, savedBytes };
    }

    function isCompressibleImageDataUrl(value) {
        return typeof value === 'string'
            && /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value)
            && value.length > 4096;
    }

    async function compressImageDataUrl(dataUrl, preset, exportTask) {
        throwIfExportCancelled(exportTask);
        const image = await loadImage(dataUrl, exportTask);
        throwIfExportCancelled(exportTask);
        const maxSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
        if (!maxSide) {
            return '';
        }

        const scale = Math.min(1, preset.maxEdge / maxSide);
        const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
            return '';
        }

        throwIfExportCancelled(exportTask);
        context.drawImage(image, 0, 0, width, height);
        const blob = await canvasToBlob(canvas, 'image/webp', preset.quality, exportTask);
        if (!blob) {
            return '';
        }

        throwIfExportCancelled(exportTask);
        return await blobToDataUrl(blob, exportTask);
    }

    function loadImage(src, exportTask) {
        return new Promise((resolve, reject) => {
            try {
                throwIfExportCancelled(exportTask);
            } catch (error) {
                reject(error);
                return;
            }

            const image = new Image();
            const cleanup = () => {
                image.onload = null;
                image.onerror = null;
                exportTask?.signal?.removeEventListener('abort', onAbort);
            };
            const onAbort = () => {
                cleanup();
                image.src = '';
                reject(createExportCancelledError());
            };
            image.onload = () => {
                cleanup();
                resolve(image);
            };
            image.onerror = () => {
                cleanup();
                reject(new Error('Image load failed'));
            };
            exportTask?.signal?.addEventListener('abort', onAbort, { once: true });
            image.src = src;
        });
    }

    function canvasToBlob(canvas, type, quality, exportTask) {
        return new Promise((resolve, reject) => {
            try {
                throwIfExportCancelled(exportTask);
            } catch (error) {
                reject(error);
                return;
            }

            const cleanup = () => exportTask?.signal?.removeEventListener('abort', onAbort);
            const onAbort = () => {
                cleanup();
                reject(createExportCancelledError());
            };
            exportTask?.signal?.addEventListener('abort', onAbort, { once: true });

            canvas.toBlob(blob => {
                cleanup();
                if (exportTask?.signal?.aborted) {
                    reject(createExportCancelledError());
                } else {
                    resolve(blob);
                }
            }, type, quality);
        });
    }

    function estimateDataUrlBytes(value) {
        if (typeof value !== 'string') {
            return 0;
        }

        const commaIndex = value.indexOf(',');
        if (commaIndex === -1) {
            return value.length;
        }

        const header = value.slice(0, commaIndex);
        const payload = value.slice(commaIndex + 1);
        if (!header.includes(';base64')) {
            return payload.length;
        }

        const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return '0 B';
        }

        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
        return `${value.toFixed(digits)} ${units[unitIndex]}`;
    }

    async function fetchAsDataUrl(url, exportTask) {
        throwIfExportCancelled(exportTask);
        const response = await fetchWithTimeout(url, exportTask);
        throwIfExportCancelled(exportTask);
        if (!response.ok) {
            throw new Error(`\u8d44\u6e90\u8bfb\u53d6\u5931\u8d25\uff1a${response.status}`);
        }

        if (isCssResource(response, url)) {
            const cssText = await response.text();
            throwIfExportCancelled(exportTask);
            const resolvedCss = absolutizeCssUrls(cssText, response.url || url);
            return await blobToDataUrl(new Blob([resolvedCss], { type: 'text/css;charset=utf-8' }), exportTask);
        }

        const blob = await response.blob();
        throwIfExportCancelled(exportTask);
        return await blobToDataUrl(blob, exportTask);
    }

    function getExportAssetCache(exportTask) {
        return exportTask?.assetCache instanceof Map ? exportTask.assetCache : new Map();
    }

    async function getAssetDataUrl(url, cache, exportTask) {
        let pending = cache.get(url);
        if (!pending) {
            pending = scheduleAssetFetch(() => fetchAsDataUrl(url, exportTask), exportTask);
            cache.set(url, pending);
        }

        try {
            return await pending;
        } catch (error) {
            if (cache.get(url) === pending) {
                cache.delete(url);
            }
            throw error;
        }
    }

    function scheduleAssetFetch(fetcher, exportTask) {
        const scheduler = exportTask?.assetFetchScheduler;
        if (!scheduler) {
            return fetcher();
        }

        return new Promise((resolve, reject) => {
            scheduler.queue.push({ fetcher, resolve, reject });
            runScheduledAssetFetches(scheduler);
        });
    }

    function runScheduledAssetFetches(scheduler) {
        while (scheduler.active < assetFetchConcurrency && scheduler.queue.length > 0) {
            const job = scheduler.queue.shift();
            scheduler.active++;
            Promise.resolve()
                .then(job.fetcher)
                .then(job.resolve, job.reject)
                .finally(() => {
                    scheduler.active--;
                    runScheduledAssetFetches(scheduler);
                });
        }
    }

    function isCssResource(response, url) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.toLowerCase().includes('text/css')) {
            return true;
        }

        try {
            return new URL(url, location.href).pathname.toLowerCase().endsWith('.css');
        } catch {
            return false;
        }
    }

    function blobToDataUrl(blob, exportTask) {
        return new Promise((resolve, reject) => {
            try {
                throwIfExportCancelled(exportTask);
            } catch (error) {
                reject(error);
                return;
            }

            const reader = new FileReader();
            const cleanup = () => exportTask?.signal?.removeEventListener('abort', onAbort);
            const onAbort = () => {
                cleanup();
                reader.abort();
                reject(createExportCancelledError());
            };
            reader.onload = () => {
                cleanup();
                resolve(String(reader.result));
            };
            reader.onerror = () => {
                cleanup();
                reject(reader.error || new Error('FileReader failed'));
            };
            exportTask?.signal?.addEventListener('abort', onAbort, { once: true });
            reader.readAsDataURL(blob);
        });
    }

    async function buildHtmlDocument(exportRoot, messageCount, exportOptions, backgroundSnapshot, assetMap, readerData, exportTask) {
        throwIfExportCancelled(exportTask);
        const styles = exportOptions.copyPageStyles ? await collectReadableStyles(exportTask) : '';
        throwIfExportCancelled(exportTask);
        const themeSnapshot = exportOptions.preserveTheme ? captureThemeSnapshot() : null;
        throwIfExportCancelled(exportTask);
        const title = escapeHtml(getDocumentTitle(messageCount));
        const htmlClass = themeSnapshot?.htmlClass ? ` class="${escapeHtml(themeSnapshot.htmlClass)}"` : '';
        const bodyClass = themeSnapshot?.bodyClass ? ` class="${escapeHtml(themeSnapshot.bodyClass)}"` : '';
        const bodyStyle = backgroundSnapshot && !backgroundSnapshot.videoHtml
            ? ` style="${escapeHtml(styleObjectToCss(backgroundSnapshot.styles))}"`
            : '';
        const backgroundHtml = backgroundSnapshot?.videoHtml
            ? `<div class="export-visual-background" style="${escapeHtml(styleObjectToCss(backgroundSnapshot.styles))}">${backgroundSnapshot.videoHtml || ''}</div>`
            : '';
        const assetMapHtml = Object.keys(assetMap).length
            ? `<script type="application/json" id="export-asset-map">${escapeScriptJson(assetMap)}</script>`
            : '';
        const readerDataHtml = `<script type="application/json" id="export-reader-data">${escapeScriptJson(readerData)}</script>`;

        return `<!doctype html>
<html lang="zh-CN"${htmlClass}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${styles}

${themeSnapshot ? buildThemeSnapshotCss(themeSnapshot) : ''}

${getExportPageCss()}
</style>
</head>
<body${bodyClass}${bodyStyle}>
${backgroundHtml}
${exportRoot.outerHTML}
${assetMapHtml}
${readerDataHtml}
<script>
${getExportPageScript()}
</script>
</body>
</html>`;
    }

    function captureThemeSnapshot() {
        const bodyStyles = window.getComputedStyle(document.body);

        return {
            htmlClass: cleanExportClassName(document.documentElement.className),
            bodyClass: cleanExportClassName(document.body.className),
            rootVariables: getCssVariables(document.documentElement, tavernThemeVariableNames),
            bodyVariables: getCssVariables(document.body),
            bodyStyles: {
                '--html-chat-export-body-background': bodyStyles.backgroundColor,
                '--html-chat-export-body-color': bodyStyles.color,
                '--html-chat-export-font-family': bodyStyles.fontFamily,
                '--html-chat-export-font-size': bodyStyles.fontSize,
                '--html-chat-export-line-height': bodyStyles.lineHeight,
            },
        };
    }

    async function captureVisualBackgroundSnapshot(embedAssets, exportTask) {
        throwIfExportCancelled(exportTask);
        const background = findVisualBackgroundSource();
        if (!background) {
            return null;
        }

        const computed = getBackgroundComputedStyle(background.element, background.pseudoElement);
        if (!computed) {
            return null;
        }

        if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
            return null;
        }

        const hasBackgroundImage = computed.backgroundImage && computed.backgroundImage !== 'none';
        const hasBackgroundColor = computed.backgroundColor && !isTransparentColor(computed.backgroundColor);
        const videoSnapshot = background.pseudoElement
            ? { html: '' }
            : await captureBackgroundVideo(background.element, embedAssets, exportTask);
        if (!hasBackgroundImage && !hasBackgroundColor && !videoSnapshot.html) {
            return null;
        }

        const styles = {};
        const cache = getExportAssetCache(exportTask);
        let failed = 0;

        for (const property of backgroundStyleProperties) {
            throwIfExportCancelled(exportTask);

            let value = computed.getPropertyValue(property);
            if (!value) {
                continue;
            }

            if (embedAssets && value.includes('url(')) {
                const result = await inlineCssUrls(value, cache, location.href, exportTask);
                value = result.cssText;
                failed += result.failed;
            }

            styles[property] = value;
        }

        if (failed > 0) {
            notify(`\u80cc\u666f\u4e2d ${failed} \u4e2a\u8d44\u6e90\u672a\u80fd\u5185\u5d4c\uff0cHTML\u4e2d\u4f1a\u4fdd\u7559\u539f\u94fe\u63a5\u3002`, 'warning');
        }

        return {
            styles,
            videoHtml: videoSnapshot.html,
        };
    }

    function findVisualBackgroundSource() {
        const candidates = [
            document.querySelector('#bg1'),
            document.querySelector('#bg_custom'),
            document.querySelector('[data-background]'),
            document.body,
            document.documentElement,
        ].filter(Boolean);
        const seen = new Set();
        let colorFallback = null;

        for (const candidate of candidates) {
            if (!(candidate instanceof HTMLElement) || seen.has(candidate)) {
                continue;
            }
            seen.add(candidate);

            const sources = [
                readVisualBackgroundSource(candidate, null),
                readVisualBackgroundSource(candidate, '::before'),
                readVisualBackgroundSource(candidate, '::after'),
            ].filter(Boolean);

            for (const source of sources) {
                if (source.priority === 2) {
                    return source;
                }
                if (!colorFallback) {
                    colorFallback = source;
                }
            }
        }

        return colorFallback;
    }

    function readVisualBackgroundSource(element, pseudoElement) {
        const computed = getBackgroundComputedStyle(element, pseudoElement);
        if (!computed) {
            return null;
        }

        if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
            return null;
        }

        if (pseudoElement) {
            const content = String(computed.content || '').trim();
            if (content === 'none' || content === 'normal') {
                return null;
            }
        }

        const hasBackgroundImage = computed.backgroundImage && computed.backgroundImage !== 'none';
        const hasBackgroundColor = computed.backgroundColor && !isTransparentColor(computed.backgroundColor);
        const hasVideo = !pseudoElement && (element.matches('video') || Boolean(element.querySelector('video')));

        if (hasBackgroundImage || hasVideo) {
            return { element, pseudoElement, priority: 2 };
        }

        if (hasBackgroundColor) {
            return { element, pseudoElement, priority: 1 };
        }

        return null;
    }

    function getBackgroundComputedStyle(element, pseudoElement) {
        try {
            return pseudoElement ? window.getComputedStyle(element, pseudoElement) : window.getComputedStyle(element);
        } catch (error) {
            console.warn('[拾玉-HTML导出] failed to read background style:', pseudoElement || element, error);
            return null;
        }
    }

    async function captureBackgroundVideo(background, embedAssets, exportTask) {
        throwIfExportCancelled(exportTask);
        const sourceVideo = background.matches('video') ? background : background.querySelector('video');
        if (!(sourceVideo instanceof HTMLVideoElement)) {
            return { html: '' };
        }

        const clone = document.createElement('video');
        clone.className = 'export-visual-background-video';
        clone.autoplay = true;
        clone.loop = true;
        clone.muted = true;
        clone.playsInline = true;

        const source = sourceVideo.currentSrc
            || sourceVideo.getAttribute('src')
            || sourceVideo.querySelector('source[src]')?.getAttribute('src')
            || '';

        if (source) {
            clone.setAttribute('src', await maybeInlineUrl(source, embedAssets, exportTask));
        }

        const poster = sourceVideo.getAttribute('poster');
        if (poster) {
            clone.setAttribute('poster', await maybeInlineUrl(poster, embedAssets, exportTask));
        }

        if (!source && !poster) {
            return { html: '' };
        }

        return {
            html: clone.outerHTML,
        };
    }

    async function maybeInlineUrl(url, embedAssets, exportTask) {
        throwIfExportCancelled(exportTask);
        if (!embedAssets || url.startsWith('data:')) {
            return url;
        }

        try {
            const absoluteUrl = new URL(url, location.href).href;
            return await getAssetDataUrl(absoluteUrl, getExportAssetCache(exportTask), exportTask);
        } catch (error) {
            if (isExportCancelled(error, exportTask)) {
                throw error;
            }

            console.warn('[拾玉-HTML导出] failed to inline background video asset:', url, error);
            return url;
        }
    }

    function getCssVariables(element, requiredProperties = []) {
        const style = window.getComputedStyle(element);
        const variables = {};
        const properties = new Set(requiredProperties);

        for (let i = 0; i < element.style.length; i++) {
            const property = element.style.item(i);
            if (property.startsWith('--')) {
                properties.add(property);
            }
        }

        for (let i = 0; i < style.length; i++) {
            const property = style.item(i);
            if (property.startsWith('--')) {
                properties.add(property);
            }
        }

        for (const property of properties) {
            const value = style.getPropertyValue(property).trim();
            if (value) {
                variables[property] = value;
            }
        }

        return variables;
    }

    function buildThemeSnapshotCss(snapshot) {
        const rootStyles = {
            ...snapshot.rootVariables,
            ...snapshot.bodyStyles,
        };

        return `
:root {
${styleObjectToCss(rootStyles, '    ')}
}

body {
    --export-reader-font-scale: 1;
    --export-reader-scaled-font-size: var(--html-chat-export-font-size, 18px);
    background: var(--html-chat-export-body-background, #101014);
    color: var(--html-chat-export-body-color, var(--SmartThemeBodyColor, #ddd));
    font-family: var(--html-chat-export-font-family, inherit);
    font-size: var(--html-chat-export-font-size, inherit);
    line-height: var(--html-chat-export-line-height, inherit);
${styleObjectToCss(snapshot.bodyVariables, '    ')}
}
`;
    }

    function getExportPageCss() {
        return `
html, body {
    margin: 0;
    min-height: 100%;
}

body {
    background: var(--html-chat-export-body-background, #101014);
    color: var(--html-chat-export-body-color, var(--SmartThemeBodyColor, #ddd));
    font-family: var(--html-chat-export-font-family, inherit);
    font-size: var(--html-chat-export-font-size, inherit);
    line-height: var(--html-chat-export-line-height, inherit);
    overflow-x: auto;
    overflow-y: scroll;
    scrollbar-color: var(--SmartThemeQuoteColor, rgba(180, 180, 180, 0.72)) rgba(0, 0, 0, 0.18);
    scrollbar-width: thin;
}

body::-webkit-scrollbar {
    width: 12px;
}

body::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.18);
}

body::-webkit-scrollbar-thumb {
    background: var(--SmartThemeQuoteColor, rgba(180, 180, 180, 0.72));
    border: 3px solid rgba(0, 0, 0, 0.18);
    border-radius: 999px;
}

.export-visual-background {
    height: 100vh;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    position: fixed;
    width: 100vw;
    z-index: 0;
}

.export-visual-background-video {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
}

.html-chat-export-shell {
    box-sizing: border-box;
    min-height: 100vh;
    padding: 20px 16px 36px;
    position: relative;
    z-index: 1;
}

.html-chat-export {
    box-sizing: border-box;
    height: auto !important;
    margin: 0 auto;
    max-width: min(var(--sheldWidth, 1320px), 100%);
    max-height: none !important;
    min-height: 0 !important;
    overflow: visible !important;
}

.html-chat-export .mes {
    box-sizing: border-box;
    scroll-margin-top: 18px;
}

.export-reader-normalized-message {
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.72)) 72%, transparent);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 8px;
    box-sizing: border-box;
    display: block !important;
    margin: 0 0 16px !important;
    min-height: 0 !important;
    padding: 12px 14px !important;
    position: relative;
}

.export-reader-floor {
    color: var(--SmartThemeQuoteColor, #c8c2a2);
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 8px;
    user-select: text;
}

.export-reader-message-with-chrome .export-reader-floor {
    margin-bottom: 10px;
}

.export-message-chrome {
    align-items: center;
    border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.14));
    display: flex;
    gap: 10px;
    margin: 0 0 12px;
    min-height: 38px;
    padding: 0 0 10px;
}

.export-message-avatar {
    border-radius: 50%;
    flex: 0 0 36px;
    height: 36px;
    overflow: hidden;
    width: 36px;
}

.export-message-avatar img {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
}

.export-message-meta {
    min-width: 0;
}

.export-message-name {
    color: var(--SmartThemeQuoteColor, #d7d1af);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: anywhere;
}

.export-message-details {
    font-size: 12px;
    line-height: 1.35;
    opacity: 0.74;
    overflow-wrap: anywhere;
}

.export-reader-content,
.export-reader-content-inner {
    box-sizing: border-box;
    max-height: none !important;
    min-height: 0 !important;
    overflow: visible !important;
}

.export-reader-normalized-message .export-reader-content-inner {
    margin: 0 !important;
    padding: 0 !important;
}

.export-reader-source-message .export-reader-floor {
    position: relative;
    z-index: 4;
}

.export-reader-outside-content {
    margin-top: 10px !important;
}

.export-reader-data-media {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    margin-top: 10px !important;
    padding: 0 !important;
}

.export-reader-data-media .export-reader-data-media-item {
    max-width: 100%;
}

.export-reader-data-media .mes_img_container,
.export-reader-data-media .mes_video_container {
    display: flex !important;
}

.export-reader-data-media .mes_audio_container,
.export-reader-data-media audio {
    max-width: 100%;
}

.html-chat-export-indent-paragraphs .export-reader-content-inner p {
    text-indent: 2em !important;
}

.export-reader-content-inner pre,
.export-reader-content-inner code {
    box-sizing: border-box;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.export-reader-content-inner pre {
    max-width: 100%;
    overflow: auto;
}

.html-chat-export img,
.html-chat-export video {
    max-width: 100%;
}

.html-chat-export img {
    cursor: zoom-in;
}

.html-chat-export q::before,
.html-chat-export q::after {
    content: none !important;
}

body.html-chat-export-mobile {
    overflow-x: hidden !important;
}

body.html-chat-export-mobile .export-visual-background {
    height: var(--export-vv-height, 100dvh);
    left: var(--export-vv-left, 0px);
    top: var(--export-vv-top, 0px);
    width: var(--export-vv-width, 100dvw);
}

body.html-chat-export-mobile .html-chat-export-shell {
    box-sizing: border-box;
    max-width: 100%;
    overflow-x: hidden;
    padding: 10px;
    width: 100%;
}

body.html-chat-export-mobile .html-chat-export,
body.html-chat-export-mobile .export-chapter,
body.html-chat-export-mobile .export-chapter-body,
body.html-chat-export-mobile .export-reader-message,
body.html-chat-export-mobile .export-reader-content,
body.html-chat-export-mobile .export-reader-content-inner {
    box-sizing: border-box !important;
    max-width: 100% !important;
    min-width: 0 !important;
    width: 100% !important;
}

body.html-chat-export-mobile .export-reader-message {
    margin-bottom: 12px !important;
    overflow: hidden !important;
    padding: 10px !important;
}

body.html-chat-export-mobile .export-reader-floor {
    font-size: 12px !important;
    margin-bottom: 6px;
}

body.html-chat-export-mobile .export-reader-content-inner {
    font-size: var(--export-reader-scaled-font-size, var(--html-chat-export-font-size, 18px)) !important;
    overflow-wrap: anywhere;
}

body.html-chat-export-mobile .export-reader-content-inner :where(div, section, article, aside, figure, figcaption, p, blockquote, pre, table, ul, ol, li, h1, h2, h3, h4, h5, h6):not(:where(.export-mobile-scaled *)) {
    box-sizing: border-box !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow-wrap: anywhere;
}

body.html-chat-export-mobile .export-reader-content-inner .export-independent-scroll-area {
    max-width: 100% !important;
    overflow: auto !important;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
}

body.html-chat-export-mobile .export-reader-content-inner .export-independent-scroll-area[style*="width" i] {
    width: 100% !important;
}

body.html-chat-export-mobile .export-reader-content-inner .export-mobile-scaled,
body.html-chat-export-mobile .export-reader-content-inner .export-mobile-scaled :where(div, section, article, aside, figure, figcaption, p, blockquote, pre, table, ul, ol, li, h1, h2, h3, h4, h5, h6) {
    max-width: none !important;
    overflow-wrap: normal !important;
}

body.html-chat-export-mobile .export-reader-content-inner :where(div, section, article, aside, figure, figcaption, p, blockquote, pre, table, ul, ol, li, h1, h2, h3, h4, h5, h6)[style*="min-width" i]:not(:where(.export-mobile-scaled *)) {
    min-width: 0 !important;
}

body.html-chat-export-mobile .export-reader-content-inner :where(div, section, article, aside, figure, figcaption, p, blockquote, pre, table, ul, ol, li, h1, h2, h3, h4, h5, h6)[style*="width" i][style*="margin-left" i],
body.html-chat-export-mobile .export-reader-content-inner :where(div, section, article, aside, figure, figcaption, p, blockquote, pre, table, ul, ol, li, h1, h2, h3, h4, h5, h6)[style*="width" i][style*="margin-right" i] {
    margin-left: auto !important;
    margin-right: auto !important;
}

body.html-chat-export-mobile .export-reader-content-inner :where(div, section, article, aside, figure, figcaption, blockquote)[style*="max-width" i][style*="margin" i]:not(:where(.export-mobile-scaled *)) {
    margin-left: auto !important;
    margin-right: auto !important;
}

body.html-chat-export-mobile .export-reader-content-inner .export-mobile-scaled {
    display: block !important;
    left: auto !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    max-width: none !important;
    min-width: 0 !important;
    position: relative !important;
    right: auto !important;
    transform: scale(var(--export-mobile-scale)) !important;
    transform-origin: top left !important;
    width: var(--export-mobile-original-width) !important;
}

body.html-chat-export-mobile .export-reader-content-inner details {
    max-width: 100% !important;
}

body.html-chat-export-mobile .export-reader-content-inner details:not([open]) {
    height: auto !important;
    max-height: none !important;
    min-height: 0 !important;
}

body.html-chat-export-mobile .export-reader-content-inner details summary {
    box-sizing: border-box !important;
    max-width: 100% !important;
    overflow-wrap: anywhere;
}

body.html-chat-export-mobile .export-reader-content .export-mobile-scale-shell,
body.html-chat-export-mobile .export-reader-content-inner .export-mobile-scale-shell {
    box-sizing: border-box !important;
    max-width: 100% !important;
    overflow: visible !important;
    transform: translateX(var(--export-mobile-shift-x, 0px)) !important;
    transform-origin: top left !important;
    width: 100% !important;
}

body.html-chat-export-mobile .export-reader-content-inner table {
    display: block !important;
    overflow-x: auto !important;
    width: 100% !important;
}

body.html-chat-export-mobile .export-reader-content-inner pre {
    overflow-x: auto !important;
    white-space: pre !important;
    word-break: normal;
}

body.html-chat-export-mobile .export-reader-content-inner code {
    overflow-wrap: normal;
    white-space: inherit !important;
    word-break: normal;
}

body.html-chat-export-mobile .export-reader-content-inner img,
body.html-chat-export-mobile .export-reader-content-inner video,
body.html-chat-export-mobile .export-reader-content-inner svg,
body.html-chat-export-mobile .export-reader-content-inner canvas,
body.html-chat-export-mobile .export-reader-content-inner iframe {
    height: auto;
    max-width: 100% !important;
}

body.html-chat-export-mobile .export-chapter-title {
    align-items: flex-start;
    box-sizing: border-box;
    gap: 8px;
    line-height: 1.3;
    min-width: 0;
    padding: 7px 9px;
}

body.html-chat-export-mobile .export-chapter-title span {
    min-width: 0;
    overflow-wrap: anywhere;
    text-align: left;
}

body.html-chat-export-mobile .export-chapter-title small {
    flex: 0 0 auto;
    font-size: 12px;
    line-height: 1.3;
}

.export-nav {
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.4;
    position: fixed;
    right: 18px;
    top: 18px;
    width: auto;
    z-index: 50;
}

.export-scrollbar {
    background: rgba(0, 0, 0, 0.18);
    border-radius: 999px;
    bottom: 18px;
    box-sizing: border-box;
    padding: 2px;
    position: fixed;
    right: 4px;
    top: 18px;
    touch-action: none;
    width: 12px;
    z-index: 45;
}

.export-scrollbar-thumb {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor, #c8c2a2) 78%, white);
    border-radius: 999px;
    cursor: grab;
    min-height: 42px;
    position: absolute;
    right: 2px;
    top: 2px;
    width: 8px;
}

.export-scrollbar.is-dragging .export-scrollbar-thumb {
    cursor: grabbing;
}

.export-nav-toggle {
    align-items: center;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.76)) 78%, transparent);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.36));
    border-radius: 50%;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
    color: inherit;
    cursor: grab;
    display: flex;
    font-size: 14px;
    font-weight: 700;
    height: 64px;
    justify-content: center;
    letter-spacing: 0;
    padding: 0;
    touch-action: none;
    user-select: none;
    width: 64px;
}

.export-nav.is-dragging .export-nav-toggle {
    cursor: grabbing;
}

.export-nav-toggle:hover,
.export-nav.is-open .export-nav-toggle {
    border-color: var(--SmartThemeQuoteColor, #8ba7ff);
}

.export-nav-panel {
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor, #16161d) 88%, transparent);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 8px;
    box-sizing: border-box;
    display: none;
    left: 0;
    max-height: calc(100vh - 104px);
    overflow: auto;
    padding: 12px;
    position: absolute;
    top: 72px;
    width: min(320px, calc(100vw - 24px));
}

.export-nav.is-open .export-nav-panel {
    display: block;
}

.export-nav-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.export-nav-action {
    background: var(--black30a, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 6px;
    color: inherit;
    cursor: pointer;
    font-size: 13px !important;
    font-weight: 700;
    line-height: 1.3;
    padding: 6px 8px;
}

.export-nav-action:hover {
    border-color: var(--SmartThemeQuoteColor, #8ba7ff);
}

.export-nav-icon-action {
    align-items: center;
    display: inline-flex;
    font-size: 16px !important;
    height: 30px;
    justify-content: center;
    line-height: 1;
    padding: 0;
    width: 34px;
}

.export-nav-icon-action[data-font-cycle] {
    font-size: 13px !important;
    font-weight: 700;
    line-height: 1 !important;
}

.export-nav-icon-action.is-active {
    border-color: var(--SmartThemeQuoteColor, #8ba7ff);
}

.export-search-icon {
    box-sizing: border-box;
    display: block;
    position: relative;
    height: 14px;
    width: 14px;
}

.export-search-icon::before {
    border: 2px solid currentColor;
    border-radius: 50%;
    box-sizing: border-box;
    content: "";
    height: 9px;
    left: 1px;
    position: absolute;
    top: 1px;
    width: 9px;
}

.export-search-icon::after {
    background: currentColor;
    border-radius: 999px;
    content: "";
    height: 2px;
    left: 9px;
    position: absolute;
    top: 10px;
    transform: rotate(45deg);
    transform-origin: left center;
    width: 5px;
}

.export-nav-group {
    margin: 0 0 12px;
}

.export-nav-group summary {
    cursor: pointer;
    font-size: 14px !important;
    font-weight: 700;
    margin: 0 0 8px;
    user-select: none;
}

.export-nav-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.export-nav-list button {
    background: var(--black30a, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 6px;
    color: inherit;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px !important;
    line-height: 1.35 !important;
    padding: 6px 8px;
    text-align: left;
    width: 100%;
}

.export-nav-list button strong {
    font-size: 14px !important;
}

.export-nav-list button span {
    font-size: 13px !important;
    opacity: 0.76;
}

.export-favorite-tag {
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.14));
    border-radius: 6px;
    margin: 0 0 8px;
    padding: 6px;
}

.export-favorite-tag summary {
    margin-bottom: 6px;
}

.export-nav-list button:hover,
.export-chapter-title:hover {
    border-color: var(--SmartThemeQuoteColor, #8ba7ff);
}

.export-nav-empty {
    font-size: 14px !important;
    line-height: 1.4 !important;
    margin: 0;
    opacity: 0.72;
    padding: 6px 0;
}

.export-chapter {
    margin-bottom: 18px;
}

.export-chapter-title {
    align-items: center;
    background: var(--black30a, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 8px;
    color: inherit;
    cursor: pointer;
    display: flex;
    gap: 10px;
    justify-content: space-between;
    margin: 0 0 8px;
    padding: 8px 12px;
    width: 100%;
}

.export-chapter-title::before {
    content: "\\25BE";
}

.export-chapter.is-collapsed .export-chapter-title::before {
    content: "\\25B8";
}

.export-chapter.is-collapsed .export-chapter-body {
    display: none;
}

.export-highlight {
    animation: export-highlight-pulse 1.6s ease-out;
    outline: 2px solid var(--SmartThemeQuoteColor, #8ba7ff);
    outline-offset: -2px;
}

.export-message-edit-actions {
    display: flex;
    gap: 6px;
    position: absolute;
    right: 10px;
    top: 10px;
}

.export-message-edit-actions button {
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor, rgba(20, 20, 24, 0.82)) 82%, transparent);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.22));
    border-radius: 50%;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    height: 28px;
    line-height: 1;
    padding: 0;
    width: 28px;
}

.export-message-edit-actions button.is-active {
    border-color: var(--SmartThemeQuoteColor, #8ba7ff);
    color: var(--SmartThemeQuoteColor, #ffd76a);
}

.export-editor {
    border-top: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.14));
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
}

.export-editor[hidden] {
    display: none;
}

.export-editor label {
    font-size: 13px !important;
    font-weight: 700;
}

.export-editor-textarea {
    background: var(--black30a, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 6px;
    box-sizing: border-box;
    color: inherit;
    font-family: inherit;
    font-size: 14px !important;
    line-height: 1.4 !important;
    min-height: 84px;
    padding: 8px;
    resize: vertical;
    width: 100%;
}

.export-editor-status {
    font-size: 12px !important;
    line-height: 1.35 !important;
    margin: 0;
    min-height: 16px;
    opacity: 0.78;
}

.export-search {
    border-top: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.14));
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 0 12px;
    padding-top: 12px;
}

.export-search[hidden] {
    display: none;
}

.export-search label {
    font-size: 13px !important;
    font-weight: 700;
}

.export-search-row {
    display: grid;
    gap: 6px;
    grid-template-columns: minmax(0, 1fr) 34px 34px;
}

.export-search-input {
    background: var(--black30a, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 6px;
    box-sizing: border-box;
    color: inherit;
    font-family: inherit;
    font-size: 14px !important;
    line-height: 1.4 !important;
    min-width: 0;
    padding: 6px 8px;
    width: 100%;
}

.export-search-status {
    font-size: 12px !important;
    line-height: 1.35 !important;
    margin: 0;
    min-height: 16px;
    opacity: 0.78;
}

.export-search-mark {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor, #ffd76a) 65%, transparent);
    border-radius: 3px;
    color: #111;
    padding: 0 2px;
}

.export-search-mark.is-active {
    outline: 2px solid var(--SmartThemeQuoteColor, #ffd76a);
    outline-offset: 1px;
}

.export-image-viewer {
    align-items: center;
    background: rgba(0, 0, 0, 0.72);
    box-sizing: border-box;
    display: flex;
    inset: 0;
    justify-content: center;
    padding: 16px;
    position: fixed;
    z-index: 90;
}

.export-image-viewer[hidden] {
    display: none;
}

.export-image-viewer-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    max-height: calc(100vh - 32px);
    max-width: min(96vw, 1280px);
}

.export-image-viewer-panel img {
    border-radius: 6px;
    cursor: zoom-in;
    display: block;
    height: auto;
    max-height: calc(100vh - 88px);
    max-width: 100%;
    object-fit: contain;
    width: auto;
}

.export-image-viewer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
}

.export-image-viewer-actions a,
.export-image-viewer-actions button {
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor, #16161d) 90%, transparent);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.28));
    border-radius: 6px;
    box-sizing: border-box;
    color: inherit;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px !important;
    font-weight: 700;
    line-height: 1.35 !important;
    padding: 7px 10px;
    text-decoration: none;
}

.export-image-viewer-actions a:hover,
.export-image-viewer-actions button:hover {
    border-color: var(--SmartThemeQuoteColor, #8ba7ff);
}

.export-favorite-picker {
    background: rgba(0, 0, 0, 0.42);
    inset: 0;
    padding: 16px;
    position: fixed;
    z-index: 80;
}

.export-favorite-picker[hidden] {
    display: none;
}

.export-favorite-picker-panel {
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor, #16161d) 92%, transparent);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.22));
    border-radius: 8px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: min(18vh, 120px) auto 0;
    max-width: 340px;
    padding: 14px;
}

.export-favorite-picker-panel h2 {
    font-size: 16px !important;
    line-height: 1.3 !important;
    margin: 0 0 4px;
}

.export-favorite-picker-panel label {
    font-size: 13px !important;
    font-weight: 700;
}

.export-favorite-picker-panel input,
.export-favorite-picker-panel select {
    background: var(--html-chat-export-control-bg, #15161c);
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18));
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--html-chat-export-control-color, #f2f2f2);
    font-family: inherit;
    font-size: 14px !important;
    line-height: 1.4 !important;
    padding: 7px 8px;
    width: 100%;
}

.export-favorite-picker-panel select option {
    background: var(--html-chat-export-option-bg, #f2f2f2);
    color: var(--html-chat-export-option-color, #16161d);
}

.export-favorite-picker-panel select option:checked {
    background: var(--html-chat-export-option-selected-bg, #6f737a);
    color: var(--html-chat-export-option-selected-color, #ffffff);
}

.export-favorite-picker-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 4px;
}

body.html-chat-export-mobile .export-nav {
    right: calc(env(safe-area-inset-right, 0px) + 10px);
    top: calc(env(safe-area-inset-top, 0px) + 10px);
}

body.html-chat-export-mobile .export-scrollbar {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
    right: calc(env(safe-area-inset-right, 0px) + 2px);
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    width: 10px;
}

body.html-chat-export-mobile .export-scrollbar-thumb {
    right: 2px;
    width: 6px;
}

body.html-chat-export-mobile .export-nav-toggle {
    font-size: 12px;
    height: 48px;
    width: 48px;
}

body.html-chat-export-mobile .export-nav-panel {
    max-height: calc(var(--export-vv-height, 100vh) - 76px);
    max-width: calc(var(--export-vv-width, 100vw) - 20px);
    top: 56px;
    width: min(320px, calc(var(--export-vv-width, 100vw) - 20px));
}

body.html-chat-export-mobile .export-nav-actions {
    display: grid;
    grid-template-columns: 34px 34px 34px minmax(0, 1fr);
}

body.html-chat-export-mobile .export-nav-action,
body.html-chat-export-mobile .export-nav-list button,
body.html-chat-export-mobile .export-nav-list button strong,
body.html-chat-export-mobile .export-nav-list button span,
body.html-chat-export-mobile .export-nav-empty,
body.html-chat-export-mobile .export-nav-group summary {
    line-height: 1.35 !important;
}

body.html-chat-export-mobile .export-favorite-picker {
    height: var(--export-vv-height, 100dvh);
    left: var(--export-vv-left, 0px);
    top: var(--export-vv-top, 0px);
    width: var(--export-vv-width, 100dvw);
}

body.html-chat-export-mobile .export-image-viewer {
    height: var(--export-vv-height, 100dvh);
    left: var(--export-vv-left, 0px);
    padding: 12px;
    top: var(--export-vv-top, 0px);
    width: var(--export-vv-width, 100dvw);
}

body.html-chat-export-mobile .export-image-viewer-panel {
    max-height: calc(var(--export-vv-height, 100vh) - 24px);
    max-width: calc(var(--export-vv-width, 100vw) - 24px);
}

body.html-chat-export-mobile .export-image-viewer-panel img {
    max-height: calc(var(--export-vv-height, 100vh) - 92px);
}

body.html-chat-export-mobile .export-favorite-picker-panel {
    margin: calc(env(safe-area-inset-top, 0px) + 16px) auto 0;
    max-height: calc(var(--export-vv-height, 100vh) - 32px);
    max-width: calc(var(--export-vv-width, 100vw) - 24px);
    overflow: auto;
}

@keyframes export-highlight-pulse {
    from { background-color: rgba(139, 167, 255, 0.22); }
    to { background-color: transparent; }
}
`;
    }

    function getExportPageScript() {
        return `
(function () {
    var embeddedAssetMarkerPrefix = '${embeddedAssetMarkerPrefix}';
    var embeddedAssetMarkerSuffix = '${embeddedAssetMarkerSuffix}';

    function hydrateAssets() {
        var assetMapElement = document.getElementById('export-asset-map');
        if (!assetMapElement) return;

        var assets = {};
        try {
            assets = JSON.parse(assetMapElement.textContent || '{}');
        } catch (error) {
            console.warn('[HTML Chat Export] failed to hydrate asset map:', error);
            return;
        }

        document.querySelectorAll('[data-export-src-ref]').forEach(function (element) {
            var value = assets[element.dataset.exportSrcRef];
            if (value) element.setAttribute('src', value);
        });

        document.querySelectorAll('[data-export-poster-ref]').forEach(function (element) {
            var value = assets[element.dataset.exportPosterRef];
            if (value) element.setAttribute('poster', value);
        });

        document.querySelectorAll('iframe[data-export-srcdoc]').forEach(function (frame) {
            var srcdoc = frame.getAttribute('data-export-srcdoc');
            if (!srcdoc || srcdoc.indexOf(embeddedAssetMarkerPrefix) === -1) return;

            Object.keys(assets).forEach(function (id) {
                srcdoc = srcdoc.split(embeddedAssetMarkerPrefix + id + embeddedAssetMarkerSuffix).join(assets[id]);
            });
            frame.setAttribute('srcdoc', srcdoc);
            frame.removeAttribute('data-export-srcdoc');
        });
    }

    function compactSnapshotFrameAssets(root) {
        var assetMapElement = root.querySelector('#export-asset-map');
        if (!assetMapElement) return;

        var assets = {};
        try {
            assets = JSON.parse(assetMapElement.textContent || '{}');
        } catch {
            return;
        }

        root.querySelectorAll('iframe[srcdoc]').forEach(function (frame) {
            var srcdoc = frame.getAttribute('srcdoc');
            if (!srcdoc) return;

            Object.keys(assets).forEach(function (id) {
                srcdoc = srcdoc.split(assets[id]).join(embeddedAssetMarkerPrefix + id + embeddedAssetMarkerSuffix);
            });
            frame.setAttribute('data-export-srcdoc', srcdoc);
            frame.removeAttribute('srcdoc');
        });
    }

    function syncSnapshotFrameHeight(frame) {
        var frameDocument;
        try {
            frameDocument = frame.contentDocument;
        } catch {
            return;
        }

        if (!frameDocument?.body) return;
        var bodyStyle = frame.contentWindow?.getComputedStyle(frameDocument.body);
        var marginTop = Number.parseFloat(bodyStyle?.marginTop) || 0;
        var marginBottom = Number.parseFloat(bodyStyle?.marginBottom) || 0;
        var height = frameDocument.body.getBoundingClientRect().height + marginTop + marginBottom;
        if (height > 0) {
            frame.style.setProperty('height', Math.ceil(height) + 'px', 'important');
        }
    }

    function setSnapshotFrameCollapseState(frame, header, content, expanded) {
        content.classList.toggle('open', expanded);
        header.setAttribute('aria-expanded', String(expanded));

        var panel = header.closest('.panel');
        var arrow = panel ? panel.querySelector('.arr') : null;
        if (arrow) arrow.classList.toggle('open', expanded);
        if (panel) {
            panel.querySelectorAll('.bar-fill').forEach(function (bar) {
                bar.classList.toggle('run', expanded);
            });
        }

        requestAnimationFrame(function () {
            syncSnapshotFrameHeight(frame);
        });
    }

    function bindSnapshotFrame(frame) {
        var frameDocument;
        try {
            frameDocument = frame.contentDocument;
        } catch {
            return;
        }

        if (!frameDocument?.documentElement || frameDocument.documentElement.dataset.exportInteractionsBound === '1') {
            return;
        }
        var headers = Array.from(frameDocument.querySelectorAll('[data-export-frame-collapse-toggle]'));
        if (!headers.length) return;

        frameDocument.documentElement.dataset.exportInteractionsBound = '1';
        headers.forEach(function (header) {
            var contentId = header.getAttribute('aria-controls');
            var content = contentId ? frameDocument.getElementById(contentId) : null;
            if (!content?.matches('[data-export-frame-collapse-content]')) return;

            var toggle = function () {
                setSnapshotFrameCollapseState(frame, header, content, !content.classList.contains('open'));
            };
            header.addEventListener('click', function (event) {
                event.preventDefault();
                toggle();
            });
            header.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggle();
            });
            content.addEventListener('transitionend', function () {
                syncSnapshotFrameHeight(frame);
            });
        });

        var FrameResizeObserver = frame.contentWindow?.ResizeObserver;
        if (FrameResizeObserver) {
            var resizeObserver = new FrameResizeObserver(function () {
                syncSnapshotFrameHeight(frame);
            });
            if (frameDocument.body) resizeObserver.observe(frameDocument.body);
            frameDocument.querySelectorAll('[data-export-frame-collapse-content]').forEach(function (content) {
                resizeObserver.observe(content);
            });
        }

        if (frameDocument.fonts?.ready) {
            frameDocument.fonts.ready.then(function () {
                syncSnapshotFrameHeight(frame);
            });
        }
        syncSnapshotFrameHeight(frame);
    }

    function initSnapshotFrames() {
        document.querySelectorAll('iframe[srcdoc]').forEach(function (frame) {
            frame.addEventListener('load', function () {
                bindSnapshotFrame(frame);
            });
            if (frame.contentDocument?.readyState === 'complete') {
                bindSnapshotFrame(frame);
            }
        });
    }

    function getVisualViewportBox() {
        var viewport = window.visualViewport;
        var width = viewport ? viewport.width : window.innerWidth;
        var height = viewport ? viewport.height : window.innerHeight;

        return {
            left: viewport ? viewport.offsetLeft : 0,
            top: viewport ? viewport.offsetTop : 0,
            width: Number.isFinite(width) ? width : document.documentElement.clientWidth,
            height: Number.isFinite(height) ? height : document.documentElement.clientHeight,
        };
    }

    function syncReaderViewport() {
        var box = getVisualViewportBox();
        var root = document.documentElement;
        root.style.setProperty('--export-vv-left', box.left + 'px');
        root.style.setProperty('--export-vv-top', box.top + 'px');
        root.style.setProperty('--export-vv-width', box.width + 'px');
        root.style.setProperty('--export-vv-height', box.height + 'px');

        var isMobile = box.width < 740;
        document.body.classList.toggle('html-chat-export-mobile', isMobile);
        document.body.classList.toggle('html-chat-export-desktop', !isMobile);
        requestAnimationFrame(syncMobileContentScaling);
    }

    function initReaderViewport() {
        syncReaderViewport();
        window.addEventListener('resize', syncReaderViewport);
        window.addEventListener('orientationchange', syncReaderViewport);

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncReaderViewport);
            window.visualViewport.addEventListener('scroll', syncReaderViewport);
        }
    }

    var unnamedChapterTitle = '\\u65e0\\u540d\\u4e4b\\u7ae0';
    var defaultFavoriteTag = '\\u672a\\u5206\\u7ec4\\u6536\\u85cf';
    var readerState = null;
    var messageMap = new Map();
    var pendingFavoriteFloor = null;
    var searchMatches = [];
    var activeSearchIndex = -1;
    var fontScaleLevels = [
        { id: 'small', label: '\\u5c0f', value: 0.92 },
        { id: 'normal', label: '\\u6807', value: 1 },
        { id: 'large', label: '\\u5927', value: 1.12 },
        { id: 'xlarge', label: '\\u8d85', value: 1.25 },
    ];
    var fontScaleStorageKey = 'html-chat-export-font-scale';
    var currentFontScaleIndex = 1;

    function initEditableReader() {
        readerState = loadReaderData();
        messageMap = collectMessageMap();
        if (!readerState.floors.length) {
            readerState.floors = Array.from(messageMap.keys()).sort(function (a, b) { return a - b; });
        }

        readerState.chapters = buildReaderChapterPlan(readerState.floors, readerState.chapters);
        renderChapters();
        renderNavigation();
        renderEditorFields();
        syncReaderData();
    }

    function loadReaderData() {
        var dataElement = document.getElementById('export-reader-data');
        var data = {};
        if (dataElement) {
            try {
                data = JSON.parse(dataElement.textContent || '{}');
            } catch (error) {
                console.warn('[HTML Chat Export] failed to read reader data:', error);
            }
        }

        var floors = normalizeFloorList(data.floors);
        if (!floors.length) {
            floors = getFloorsFromDom();
        }

        var floorSet = new Set(floors);
        return {
            version: 1,
            floors: floors,
            favorites: normalizeFavorites(data.favorites, floorSet),
            chapters: normalizeChapters(data.chapters),
        };
    }

    function normalizeFloorList(value) {
        if (!Array.isArray(value)) return [];

        return Array.from(new Set(value.map(function (floor) {
            return Number(floor);
        }).filter(Number.isInteger))).sort(function (a, b) {
            return a - b;
        });
    }

    function normalizeFavorites(value, floorSet) {
        if (!Array.isArray(value)) return [];

        var byFloor = new Map();
        value.forEach(function (favorite) {
            var floor = Number(favorite && favorite.floor);
            if (!Number.isInteger(floor) || !floorSet.has(floor)) return;

            byFloor.set(floor, {
                floor: floor,
                tag: String(favorite.tag || '').trim(),
                note: String(favorite.note || '').trim(),
            });
        });

        return Array.from(byFloor.values()).sort(function (a, b) {
            return a.floor - b.floor;
        });
    }

    function normalizeChapters(value) {
        if (!Array.isArray(value)) return [];

        return value.map(function (chapter) {
            return {
                start: Number(chapter && chapter.start),
                end: Number(chapter && chapter.end),
                title: String(chapter && chapter.title || unnamedChapterTitle).trim() || unnamedChapterTitle,
            };
        }).filter(function (chapter) {
            return Number.isInteger(chapter.start) && Number.isInteger(chapter.end) && chapter.start <= chapter.end;
        }).sort(function (a, b) {
            return a.start - b.start || a.end - b.end;
        });
    }

    function getFloorsFromDom() {
        return normalizeFloorList(Array.from(document.querySelectorAll('.mes[mesid], .mes[data-export-floor]')).map(function (message) {
            return message.getAttribute('mesid') || message.dataset.exportFloor;
        }));
    }

    function collectMessageMap() {
        var map = new Map();
        document.querySelectorAll('.mes[mesid], .mes[data-export-floor]').forEach(function (message) {
            var floor = Number(message.getAttribute('mesid') || message.dataset.exportFloor);
            if (Number.isInteger(floor)) {
                map.set(floor, message);
            }
        });
        return map;
    }

    function buildReaderChapterPlan(floors, ranges) {
        var normalizedFloors = normalizeFloorList(floors);
        var validRanges = normalizeChapters(ranges);
        var chapters = [];
        var current = null;

        normalizedFloors.forEach(function (floor) {
            var matchedRange = validRanges.find(function (range) {
                return floor >= range.start && floor <= range.end;
            });
            var key = matchedRange ? matchedRange.start + '-' + matchedRange.end + '-' + matchedRange.title : 'unnamed';
            var title = matchedRange ? matchedRange.title : unnamedChapterTitle;

            if (!current || current.key !== key) {
                current = {
                    key: key,
                    title: title,
                    start: matchedRange ? matchedRange.start : floor,
                    end: matchedRange ? matchedRange.end : floor,
                    floors: [],
                };
                chapters.push(current);
            }

            if (!matchedRange) {
                current.end = floor;
            }
            current.floors.push(floor);
        });

        return chapters.map(function (chapter) {
            return {
                title: chapter.title,
                start: chapter.start,
                end: chapter.end,
                floors: chapter.floors,
            };
        });
    }

    function renderChapters() {
        var main = document.getElementById('chat');
        if (!main || !readerState) return;

        main.innerHTML = '';
        readerState.chapters.forEach(function (chapter, index) {
            var section = document.createElement('section');
            section.className = 'export-chapter';
            section.id = 'chapter-' + index;
            section.dataset.chapterIndex = String(index);
            section.dataset.start = String(chapter.start);
            section.dataset.end = String(chapter.end);

            var header = document.createElement('button');
            header.type = 'button';
            header.className = 'export-chapter-title';
            header.dataset.chapterToggle = String(index);

            var title = document.createElement('span');
            title.textContent = chapter.title;
            var range = document.createElement('small');
            range.textContent = '#' + chapter.start + '-#' + chapter.end;
            header.append(title, range);
            section.appendChild(header);

            var body = document.createElement('div');
            body.className = 'export-chapter-body';
            chapter.floors.forEach(function (floor) {
                var message = messageMap.get(floor);
                if (message) {
                    ensureMessageEditActions(message, floor);
                    body.appendChild(message);
                }
            });

            section.appendChild(body);
            main.appendChild(section);
        });
    }

    function ensureMessageEditActions(message, floor) {
        var actions = message.querySelector(':scope > .export-message-edit-actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.className = 'export-message-edit-actions';
            message.appendChild(actions);
        }

        var active = readerState.favorites.some(function (favorite) {
            return favorite.floor === floor;
        });
        actions.innerHTML = '';

        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.toggleFavoriteFloor = String(floor);
        button.className = active ? 'is-active' : '';
        button.setAttribute('aria-label', active ? '\\u53d6\\u6d88\\u6536\\u85cf #' + floor : '\\u6536\\u85cf #' + floor);
        button.setAttribute('title', active ? '\\u53d6\\u6d88\\u6536\\u85cf' : '\\u6536\\u85cf');
        button.textContent = active ? '\\u2605' : '\\u2606';
        actions.appendChild(button);
    }

    function renderNavigation() {
        if (!readerState) return;

        renderFavoriteNavigation();
        renderDirectoryNavigation();
    }

    function renderFavoriteNavigation() {
        var container = document.querySelector('.export-favorites-content');
        if (!container) return;

        container.innerHTML = '';
        if (!readerState.favorites.length) {
            var empty = document.createElement('p');
            empty.className = 'export-nav-empty';
            empty.textContent = '\\u672a\\u6807\\u8bb0\\u6536\\u85cf\\u697c\\u5c42';
            container.appendChild(empty);
            return;
        }

        var groups = new Map();
        readerState.favorites.forEach(function (favorite) {
            var tag = favorite.tag || defaultFavoriteTag;
            if (!groups.has(tag)) groups.set(tag, []);
            groups.get(tag).push(favorite);
        });

        groups.forEach(function (favorites, tag) {
            var details = document.createElement('details');
            details.className = 'export-favorite-tag';
            details.open = true;

            var summary = document.createElement('summary');
            summary.textContent = tag;
            details.appendChild(summary);

            var list = document.createElement('ol');
            list.className = 'export-nav-list export-favorite-list';
            favorites.forEach(function (favorite) {
                var item = document.createElement('li');
                var button = document.createElement('button');
                button.type = 'button';
                button.dataset.jumpFloor = String(favorite.floor);

                var strong = document.createElement('strong');
                strong.textContent = '#' + favorite.floor;
                button.appendChild(strong);
                if (favorite.note) {
                    var note = document.createElement('span');
                    note.textContent = favorite.note;
                    button.appendChild(note);
                }

                item.appendChild(button);
                list.appendChild(item);
            });

            details.appendChild(list);
            container.appendChild(details);
        });
    }

    function renderDirectoryNavigation() {
        var list = document.querySelector('.export-directory-list');
        if (!list) return;

        list.innerHTML = '';
        readerState.chapters.forEach(function (chapter, index) {
            var item = document.createElement('li');
            var button = document.createElement('button');
            button.type = 'button';
            button.dataset.jumpChapter = String(index);

            var title = document.createElement('strong');
            title.textContent = chapter.title;
            var range = document.createElement('span');
            range.textContent = '#' + chapter.start + '-#' + chapter.end;
            button.append(title, range);
            item.appendChild(button);
            list.appendChild(item);
        });
    }

    function renderEditorFields() {
        var favoritesEditor = document.querySelector('[data-favorites-editor]');
        var chaptersEditor = document.querySelector('[data-chapters-editor]');
        if (favoritesEditor) favoritesEditor.value = favoritesToText(readerState.favorites);
        if (chaptersEditor) chaptersEditor.value = chaptersToText(readerState.chapters);
    }

    function favoritesToText(favorites) {
        return favorites.map(function (favorite) {
            return '#' + favorite.floor + ' | ' + (favorite.tag || '') + ' | ' + (favorite.note || '');
        }).join('\\n');
    }

    function chaptersToText(chapters) {
        return chapters.map(function (chapter) {
            return chapter.start + '-' + chapter.end + ' | ' + chapter.title;
        }).join('\\n');
    }

    function parseFavoritesText(text) {
        var floorSet = new Set(readerState.floors);
        var byFloor = new Map();
        var lines = String(text || '').split(/\\r?\\n|;/).map(function (line) {
            return line.trim();
        }).filter(Boolean);

        lines.forEach(function (line) {
            var parts = line.split('|').map(function (part) {
                return part.trim();
            });
            var floors = parts.shift().split(',').map(function (item) {
                return Number(item.trim().replace(/^#/, ''));
            }).filter(Number.isInteger);
            if (!floors.length) {
                throw new Error('\\u6536\\u85cf\\u697c\\u5c42\\u65e0\\u6548\\uff1a' + line);
            }

            var tag = parts.length ? parts.shift() : '';
            var note = parts.length ? parts.join('|').trim() : '';
            floors.forEach(function (floor) {
                if (!floorSet.has(floor)) {
                    throw new Error('\\u6536\\u85cf\\u697c\\u5c42\\u4e0d\\u5728\\u5f53\\u524d HTML \\u4e2d\\uff1a#' + floor);
                }

                byFloor.set(floor, {
                    floor: floor,
                    tag: tag,
                    note: note,
                });
            });
        });

        return Array.from(byFloor.values()).sort(function (a, b) {
            return a.floor - b.floor;
        });
    }

    function parseChaptersText(text) {
        var floorSet = new Set(readerState.floors);
        var ranges = [];
        var lines = String(text || '').split(/\\r?\\n|;/).map(function (line) {
            return line.trim();
        }).filter(Boolean);

        lines.forEach(function (line) {
            var parts = line.split('|');
            var rangeText = String(parts.shift() || '').trim();
            var title = parts.join('|').trim() || unnamedChapterTitle;
            var match = rangeText.match(/^#?\\s*(\\d+)\\s*(?:-|~|\\u5230|\\u81f3)\\s*#?\\s*(\\d+)$/);
            if (!match) {
                throw new Error('\\u76ee\\u5f55\\u8303\\u56f4\\u65e0\\u6548\\uff1a' + line);
            }

            var start = Number(match[1]);
            var end = Number(match[2]);
            if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
                throw new Error('\\u76ee\\u5f55\\u8303\\u56f4\\u8d77\\u6b62\\u65e0\\u6548\\uff1a' + line);
            }

            if (!floorSet.has(start) || !floorSet.has(end)) {
                throw new Error('\\u76ee\\u5f55\\u8d77\\u6b62\\u697c\\u5c42\\u5fc5\\u987b\\u5b58\\u5728\\u4e8e\\u5f53\\u524d HTML \\u4e2d\\uff1a#' + start + '-#' + end);
            }

            ranges.push({
                start: start,
                end: end,
                title: title,
            });
        });

        ranges.sort(function (a, b) {
            return a.start - b.start || a.end - b.end;
        });
        for (var i = 1; i < ranges.length; i++) {
            if (ranges[i].start <= ranges[i - 1].end) {
                throw new Error('\\u76ee\\u5f55\\u8303\\u56f4\\u4e0d\\u80fd\\u91cd\\u53e0\\uff1a#' + ranges[i - 1].start + '-#' + ranges[i - 1].end + ' \\u4e0e #' + ranges[i].start + '-#' + ranges[i].end);
            }
        }

        return buildReaderChapterPlan(readerState.floors, ranges);
    }

    function applyFavoritesEditor() {
        var editor = document.querySelector('[data-favorites-editor]');
        try {
            readerState.favorites = parseFavoritesText(editor ? editor.value : '');
            renderNavigation();
            renderChapters();
            renderEditorFields();
            syncReaderData();
            setEditorStatus('\\u6536\\u85cf\\u5df2\\u66f4\\u65b0\\u3002');
        } catch (error) {
            setEditorStatus(error.message || String(error), true);
        }
    }

    function applyChaptersEditor() {
        var editor = document.querySelector('[data-chapters-editor]');
        try {
            readerState.chapters = parseChaptersText(editor ? editor.value : '');
            renderChapters();
            renderNavigation();
            renderEditorFields();
            syncReaderData();
            setEditorStatus('\\u76ee\\u5f55\\u5df2\\u66f4\\u65b0\\u3002');
        } catch (error) {
            setEditorStatus(error.message || String(error), true);
        }
    }

    function toggleFavorite(floor) {
        var index = readerState.favorites.findIndex(function (favorite) {
            return favorite.floor === floor;
        });
        if (index === -1) {
            openFavoritePicker(floor);
            return;
        } else {
            readerState.favorites.splice(index, 1);
            setEditorStatus('#' + floor + ' \\u5df2\\u79fb\\u51fa\\u6536\\u85cf\\u3002');
        }

        renderChapters();
        renderNavigation();
        renderEditorFields();
        syncReaderData();
    }

    function openFavoritePicker(floor) {
        pendingFavoriteFloor = floor;

        var picker = document.querySelector('[data-favorite-picker]');
        var floorElement = document.querySelector('[data-favorite-picker-floor]');
        var select = document.querySelector('[data-favorite-tag-select]');
        var newTagInput = document.querySelector('[data-favorite-new-tag]');
        var noteInput = document.querySelector('[data-favorite-note]');
        if (!picker || !select || !newTagInput || !noteInput) return;

        if (floorElement) floorElement.textContent = String(floor);
        renderFavoriteTagOptions(select);
        select.value = '';
        newTagInput.value = '';
        noteInput.value = '';
        picker.hidden = false;
        newTagInput.focus();
    }

    function renderFavoriteTagOptions(select) {
        var tags = Array.from(new Set(readerState.favorites.map(function (favorite) {
            return favorite.tag;
        }).filter(Boolean))).sort(function (a, b) {
            return a.localeCompare(b);
        });

        select.innerHTML = '';
        var emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '\\u65e0\\u6807\\u7b7e';
        select.appendChild(emptyOption);

        tags.forEach(function (tag) {
            var option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            select.appendChild(option);
        });
    }

    function closeFavoritePicker() {
        var picker = document.querySelector('[data-favorite-picker]');
        if (picker) picker.hidden = true;
        pendingFavoriteFloor = null;
    }

    function confirmFavoritePicker() {
        if (!Number.isInteger(pendingFavoriteFloor)) {
            closeFavoritePicker();
            return;
        }

        var select = document.querySelector('[data-favorite-tag-select]');
        var newTagInput = document.querySelector('[data-favorite-new-tag]');
        var noteInput = document.querySelector('[data-favorite-note]');
        var selectedTag = select ? select.value.trim() : '';
        var newTag = newTagInput ? newTagInput.value.trim() : '';
        var tag = newTag || selectedTag;
        var note = noteInput ? noteInput.value.trim() : '';

        readerState.favorites.push({
            floor: pendingFavoriteFloor,
            tag: tag,
            note: note,
        });
        readerState.favorites.sort(function (a, b) {
            return a.floor - b.floor;
        });

        var floor = pendingFavoriteFloor;
        closeFavoritePicker();
        renderChapters();
        renderNavigation();
        renderEditorFields();
        syncReaderData();
        setEditorStatus('#' + floor + ' \\u5df2\\u52a0\\u5165\\u6536\\u85cf\\u3002');
    }

    function initMobileContentScaling() {
        syncMobileContentScaling();
        window.addEventListener('resize', syncMobileContentScaling);
        window.addEventListener('orientationchange', syncMobileContentScaling);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncMobileContentScaling);
        }
    }

    function syncMobileContentScaling() {
        document.querySelectorAll('.export-mobile-scaled').forEach(function (element) {
            restoreMobileScaledElement(element);
        });
        document.querySelectorAll('.export-independent-scroll-area').forEach(function (element) {
            element.classList.remove('export-independent-scroll-area');
        });

        if (!document.body.classList.contains('html-chat-export-mobile')) {
            return;
        }

        document.querySelectorAll('.export-reader-content-inner').forEach(function (root) {
            markIndependentScrollAreas(root);

            var rootRect = root.getBoundingClientRect();
            var availableWidth = Math.max(0, root.clientWidth || rootRect.width);
            if (!availableWidth) return;

            findMobileScaleTargets(root, availableWidth, rootRect).forEach(function (element) {
                if (!element.isConnected || element.closest('.export-mobile-scale-shell')) {
                    return;
                }

                var style = window.getComputedStyle(element);
                var scaleMetrics = measureMobileScaleTarget(element, style, rootRect, availableWidth);
                if (scaleMetrics.canScale) {
                    applyMobileScale(element, scaleMetrics.naturalWidth, availableWidth);
                }
            });
        });
    }

    function markIndependentScrollAreas(root) {
        root.querySelectorAll('*').forEach(function (element) {
            if (isIndependentScrollArea(element)) {
                element.classList.add('export-independent-scroll-area');
            }
        });
    }

    function findMobileScaleTargets(root, availableWidth, rootRect) {
        var targets = [];
        var candidates = Array.from(root.querySelectorAll(':scope > *, :scope > * *'));

        candidates.forEach(function (element) {
            if (!(element instanceof HTMLElement) || shouldSkipMobileScale(element)) {
                return;
            }

            var style = window.getComputedStyle(element);
            var scaleMetrics = measureMobileScaleTarget(element, style, rootRect, availableWidth);
            if (!scaleMetrics.canScale) {
                return;
            }

            var parent = element.parentElement;
            while (parent && parent !== root) {
                if (targets.includes(parent)) {
                    return;
                }
                parent = parent.parentElement;
            }

            targets = targets.filter(function (target) {
                return !element.contains(target);
            });
            targets.push(element);
        });

        return targets;
    }

    function measureMobileScaleTarget(element, style, rootRect, availableWidth) {
        var rect = element.getBoundingClientRect();
        var declaredWidth = getDeclaredPixelWidth(element, style);
        var visualOverflow = Math.max(0, rect.right - rootRect.right, rootRect.left - rect.left);
        var naturalWidth = Math.max(declaredWidth, element.scrollWidth, rect.width + visualOverflow);
        var canScale = naturalWidth > availableWidth + 4
            && style.display !== 'inline'
            && style.position !== 'fixed'
            && style.position !== 'sticky';

        return {
            canScale: canScale,
            naturalWidth: naturalWidth,
        };
    }

    function shouldSkipMobileScale(element) {
        if (element.matches('details, summary, pre, code, table, thead, tbody, tfoot, tr, td, th')) {
            return true;
        }

        return Boolean(element.closest('summary, pre, code, table'))
            || Boolean(element.querySelector('details'))
            || isInsideIndependentScrollArea(element);
    }

    function isInsideIndependentScrollArea(element) {
        var parent = element.parentElement;
        while (parent && !parent.classList.contains('export-reader-content-inner')) {
            if (isIndependentScrollArea(parent)) {
                return true;
            }
            parent = parent.parentElement;
        }

        return false;
    }

    function isIndependentScrollArea(element) {
        if (!(element instanceof HTMLElement)) return false;

        var style = window.getComputedStyle(element);
        var overflowY = style.overflowY;
        var overflowX = style.overflowX;
        var canScrollY = /auto|scroll|overlay/i.test(overflowY) && element.scrollHeight > element.clientHeight + 4;
        var canScrollX = /auto|scroll|overlay/i.test(overflowX) && element.scrollWidth > element.clientWidth + 4;
        return canScrollY || canScrollX;
    }

    function getDeclaredPixelWidth(element, style) {
        var inlineWidth = element.style && element.style.getPropertyValue('width');
        var inlineMinWidth = element.style && element.style.getPropertyValue('min-width');
        return Math.max(
            parsePixelValue(inlineWidth),
            parsePixelValue(inlineMinWidth),
            parsePixelValue(style.width),
            parsePixelValue(style.minWidth),
            0
        );
    }

    function parsePixelValue(value) {
        var match = String(value || '').trim().match(/^([0-9.]+)px$/i);
        return match ? Number(match[1]) || 0 : 0;
    }

    function applyMobileScale(element, naturalWidth, availableWidth) {
        var scale = Math.min(1, availableWidth / naturalWidth);
        if (scale >= 0.995) return;

        var shell = document.createElement('div');
        shell.className = 'export-mobile-scale-shell';
        element.parentNode.insertBefore(shell, element);
        shell.appendChild(element);

        element.classList.add('export-mobile-scaled');
        element.dataset.exportMobileOriginalWidth = String(naturalWidth);
        element.style.setProperty('--export-mobile-original-width', naturalWidth + 'px');
        element.style.setProperty('--export-mobile-scale', String(scale));
        requestAnimationFrame(function () {
            if (shell.isConnected && element.isConnected) {
                var height = Math.ceil(element.getBoundingClientRect().height);
                shell.style.height = height > 0 ? height + 'px' : 'auto';
                alignMobileScaleShell(shell, element);
            }
        });
    }

    function alignMobileScaleShell(shell, element) {
        var root = shell.closest('.export-reader-content-inner');
        if (!root) return;

        var rootRect = root.getBoundingClientRect();
        var elementRect = element.getBoundingClientRect();
        var desiredLeft = elementRect.left;

        if (elementRect.width >= rootRect.width) {
            desiredLeft = rootRect.left;
        } else if (elementRect.left < rootRect.left) {
            desiredLeft = rootRect.left;
        } else if (elementRect.right > rootRect.right) {
            desiredLeft = rootRect.right - elementRect.width;
        }

        shell.style.setProperty('--export-mobile-shift-x', roundCssPixel(desiredLeft - elementRect.left) + 'px');
    }

    function roundCssPixel(value) {
        return Math.round(value * 100) / 100;
    }

    function restoreMobileScaledElement(element) {
        var shell = element.parentElement;
        if (!shell || !shell.classList.contains('export-mobile-scale-shell')) {
            return;
        }

        shell.parentNode.insertBefore(element, shell);
        shell.remove();
        element.classList.remove('export-mobile-scaled');
        element.style.removeProperty('--export-mobile-original-width');
        element.style.removeProperty('--export-mobile-scale');
        delete element.dataset.exportMobileOriginalWidth;
    }

    function setEditMode(enabled) {
        document.body.classList.toggle('export-edit-mode', enabled);
        var editor = document.querySelector('.export-editor');
        var button = document.querySelector('[data-editor-toggle]');
        if (editor) editor.hidden = !enabled;
        if (button) {
            button.classList.toggle('is-active', enabled);
            button.setAttribute('aria-label', enabled ? '\\u5b8c\\u6210\\u7f16\\u8f91' : '\\u7f16\\u8f91');
            button.setAttribute('title', enabled ? '\\u5b8c\\u6210\\u7f16\\u8f91' : '\\u7f16\\u8f91');
        }
        if (enabled) renderEditorFields();
    }

    function setEditorStatus(message, isError) {
        var status = document.querySelector('[data-editor-status]');
        if (!status) return;

        status.textContent = message || '';
        status.style.color = isError ? '#ff8a8a' : '';
    }

    function syncReaderData() {
        var dataElement = document.getElementById('export-reader-data');
        if (!dataElement) {
            dataElement = document.createElement('script');
            dataElement.type = 'application/json';
            dataElement.id = 'export-reader-data';
            document.body.appendChild(dataElement);
        }

        dataElement.textContent = JSON.stringify({
            version: 1,
            floors: readerState.floors,
            favorites: readerState.favorites,
            chapters: readerState.chapters.map(function (chapter) {
                return {
                    start: chapter.start,
                    end: chapter.end,
                    title: chapter.title,
                };
            }),
        });

        dataElement.textContent = dataElement.textContent.replace(/</g, '\\\\u003c');
    }

    function readStoredFontScaleId() {
        try {
            return localStorage.getItem(fontScaleStorageKey);
        } catch (error) {
            return '';
        }
    }

    function writeStoredFontScaleId(value) {
        try {
            localStorage.setItem(fontScaleStorageKey, value);
        } catch (error) {
            // The exported file can run from restrictive local contexts where storage is blocked.
        }
    }

    function initFontScaleControls() {
        var stored = readStoredFontScaleId();
        var storedIndex = fontScaleLevels.findIndex(function (level) {
            return level.id === stored;
        });
        setFontScale(storedIndex === -1 ? currentFontScaleIndex : storedIndex);
    }

    function setFontScale(index) {
        currentFontScaleIndex = ((index % fontScaleLevels.length) + fontScaleLevels.length) % fontScaleLevels.length;
        var level = fontScaleLevels[currentFontScaleIndex];
        document.body.style.setProperty('--export-reader-font-scale', String(level.value));
        document.body.style.setProperty('--export-reader-scaled-font-size', getScaledReaderFontSize(level.value));
        document.body.dataset.exportFontScale = level.id;
        applyFontScaleToContent(level.value);
        writeStoredFontScaleId(level.id);

        var button = document.querySelector('[data-font-cycle]');
        if (button) {
            button.textContent = level.label;
            button.setAttribute('title', '\\u5b57\\u4f53\\u5927\\u5c0f\\uff1a' + level.label);
            button.setAttribute('aria-label', '\\u5b57\\u4f53\\u5927\\u5c0f\\uff1a' + level.label);
        }

        requestAnimationFrame(syncMobileContentScaling);
    }

    function getScaledReaderFontSize(scale) {
        var base = parsePixelValue(getComputedStyle(document.body).getPropertyValue('--html-chat-export-font-size'))
            || parsePixelValue(getComputedStyle(document.body).fontSize)
            || 18;
        return roundCssPixel(base * scale) + 'px';
    }

    function cycleFontScale() {
        setFontScale(currentFontScaleIndex + 1);
    }

    function applyFontScaleToContent(scale) {
        document.querySelectorAll('.export-reader-content-inner, .export-reader-content-inner *').forEach(function (element) {
            if (!(element instanceof HTMLElement)) {
                return;
            }

            scaleInlinePixelStyle(element, 'font-size', 'exportBaseFontSize', scale);
            scaleInlinePixelStyle(element, 'line-height', 'exportBaseLineHeight', scale);
        });
    }

    function scaleInlinePixelStyle(element, property, dataKey, scale) {
        var inlineValue = element.style.getPropertyValue(property);
        if (!inlineValue) {
            return;
        }

        var baseValue = Number(element.dataset[dataKey]);
        if (!Number.isFinite(baseValue) || baseValue <= 0) {
            baseValue = parsePixelValue(inlineValue);
            if (!baseValue) {
                return;
            }
            element.dataset[dataKey] = String(baseValue);
        }

        element.style.setProperty(property, roundCssPixel(baseValue * scale) + 'px');
    }

    function roundCssPixel(value) {
        return Math.round(value * 1000) / 1000;
    }

    function applyVisibleEditorInputs() {
        var editor = document.querySelector('.export-editor');
        if (!editor || editor.hidden) return true;

        try {
            var favoritesEditor = document.querySelector('[data-favorites-editor]');
            var chaptersEditor = document.querySelector('[data-chapters-editor]');
            readerState.favorites = parseFavoritesText(favoritesEditor ? favoritesEditor.value : '');
            readerState.chapters = parseChaptersText(chaptersEditor ? chaptersEditor.value : '');
            renderChapters();
            renderNavigation();
            renderEditorFields();
            syncReaderData();
            return true;
        } catch (error) {
            setEditorStatus(error.message || String(error), true);
            return false;
        }
    }

    function saveEditedHtmlCopy() {
        if (!applyVisibleEditorInputs()) {
            return;
        }

        syncReaderData();

        var clone = document.documentElement.cloneNode(true);
        compactSnapshotFrameAssets(clone);
        clone.querySelectorAll('[data-export-src-ref]').forEach(function (element) {
            element.removeAttribute('src');
        });
        clone.querySelectorAll('[data-export-poster-ref]').forEach(function (element) {
            element.removeAttribute('poster');
        });

        if (clone.querySelector('body')) {
            clone.querySelector('body').classList.remove('export-edit-mode');
        }

        var nav = clone.querySelector('.export-nav');
        if (nav) {
            nav.classList.remove('is-open', 'is-dragging');
        }

        var toggle = clone.querySelector('.export-nav-toggle');
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
        }

        var editor = clone.querySelector('.export-editor');
        if (editor) {
            editor.setAttribute('hidden', '');
        }

        var search = clone.querySelector('.export-search');
        if (search) {
            search.setAttribute('hidden', '');
        }
        var searchToggle = clone.querySelector('[data-search-toggle]');
        if (searchToggle) {
            searchToggle.classList.remove('is-active');
        }
        clone.querySelectorAll('.export-search-mark').forEach(function (mark) {
            mark.replaceWith(mark.textContent || '');
        });

        var favoritePicker = clone.querySelector('[data-favorite-picker]');
        if (favoritePicker) {
            favoritePicker.setAttribute('hidden', '');
        }

        clone.querySelectorAll('.export-image-viewer').forEach(function (viewer) {
            viewer.remove();
        });

        var editorToggle = clone.querySelector('[data-editor-toggle]');
        if (editorToggle) {
            editorToggle.classList.remove('is-active');
            editorToggle.setAttribute('aria-label', '\\u7f16\\u8f91');
            editorToggle.setAttribute('title', '\\u7f16\\u8f91');
        }

        var html = '<!doctype html>\\n' + clone.outerHTML;
        downloadExportHtml(html, getEditedFileName());
        setEditorStatus('\\u5df2\\u4e0b\\u8f7d\\u66f4\\u65b0\\u540e\\u7684 HTML \\u526f\\u672c\\u3002');
    }

    function initImageViewer() {
        document.addEventListener('click', function (event) {
            var target = event.target;
            if (!target || typeof target.closest !== 'function') return;

            if (target.closest('.export-image-viewer')) {
                var viewerImage = target.closest('[data-image-viewer-img]');
                if (viewerImage) {
                    event.preventDefault();
                    openImageSource(getImageViewerSource(viewerImage));
                    return;
                }

                if (target.closest('[data-image-close]')) {
                    closeImageViewer();
                }
                return;
            }

            var image = target.closest('.html-chat-export img');
            if (!image || image.closest('.export-nav, .export-editor, .export-search, .export-message-edit-actions')) return;

            var src = getImageViewerSource(image);
            if (!src) return;

            event.preventDefault();
            openImageViewer(image, src);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeImageViewer();
            }
        });
    }

    function getImageViewerSource(image) {
        return image.currentSrc || image.getAttribute('src') || '';
    }

    function openImageViewer(sourceImage, src) {
        var viewer = getOrCreateImageViewer();
        var image = viewer.querySelector('[data-image-viewer-img]');
        var download = viewer.querySelector('[data-image-download]');
        var fileName = getImageDownloadFileName(sourceImage, src);

        if (image) {
            image.src = src;
            image.alt = sourceImage.getAttribute('alt') || sourceImage.getAttribute('title') || '';
            image.title = '\\u70b9\\u51fb\\u6253\\u5f00\\u539f\\u56fe';
        }

        if (download) {
            download.href = src;
            download.download = fileName;
        }

        viewer.hidden = false;
    }

    function closeImageViewer() {
        var viewer = document.querySelector('.export-image-viewer');
        if (!viewer || viewer.hidden) return;

        var image = viewer.querySelector('[data-image-viewer-img]');
        var download = viewer.querySelector('[data-image-download]');

        if (image) {
            image.removeAttribute('src');
            image.removeAttribute('alt');
            image.removeAttribute('title');
        }
        if (download) {
            download.removeAttribute('href');
            download.removeAttribute('download');
        }

        viewer.hidden = true;
    }

    function getOrCreateImageViewer() {
        var viewer = document.querySelector('.export-image-viewer');
        if (viewer) return viewer;

        viewer = document.createElement('div');
        viewer.className = 'export-image-viewer';
        viewer.hidden = true;
        viewer.innerHTML = ''
            + '<figure class="export-image-viewer-panel">'
            + '<img data-image-viewer-img alt="">'
            + '<figcaption class="export-image-viewer-actions">'
            + '<a data-image-download href="#" download>\\u4fdd\\u5b58\\u56fe\\u7247</a>'
            + '<button type="button" data-image-close>\\u5173\\u95ed</button>'
            + '</figcaption>'
            + '</figure>';
        document.body.appendChild(viewer);
        return viewer;
    }

    function openImageSource(src) {
        if (!src) return;

        var objectUrl = '';
        var targetUrl = src;
        if (/^data:image\\//i.test(src)) {
            var blob = dataUrlToBlob(src);
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                targetUrl = objectUrl;
            }
        }

        var opened = window.open(targetUrl, '_blank', 'noopener');
        if (!opened) {
            var anchor = document.createElement('a');
            anchor.href = targetUrl;
            anchor.target = '_blank';
            anchor.rel = 'noopener';
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }

        if (objectUrl) {
            setTimeout(function () {
                URL.revokeObjectURL(objectUrl);
            }, 60000);
        }
    }

    function dataUrlToBlob(dataUrl) {
        var match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(String(dataUrl || ''));
        if (!match) return null;

        var mimeType = match[1] || 'application/octet-stream';
        var isBase64 = Boolean(match[2]);
        var data = match[3] || '';
        var binary = isBase64 ? atob(data) : decodeURIComponent(data);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new Blob([bytes], { type: mimeType });
    }

    function getImageDownloadFileName(image, src) {
        var urlName = getImageFileNameFromUrl(src);
        if (urlName) return urlName;

        var message = image.closest('.mes[mesid], .mes[data-export-floor]');
        var floor = message ? message.getAttribute('mesid') || message.dataset.exportFloor : '';
        var index = message ? Array.from(message.querySelectorAll('img')).indexOf(image) + 1 : 1;
        var floorPart = floor ? '-floor-' + floor : '';
        var indexPart = index > 0 ? '-' + index : '';

        return 'chat-image' + floorPart + indexPart + '.' + getImageExtension(src);
    }

    function getImageFileNameFromUrl(src) {
        try {
            var url = new URL(src, window.location.href);
            if (url.protocol === 'data:') return '';

            var name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
            return name && /\\.[a-z0-9]{2,5}$/i.test(name) ? sanitizeFileName(name) : '';
        } catch {
            return '';
        }
    }

    function getImageExtension(src) {
        var dataMatch = /^data:image\\/([^;,]+)/i.exec(String(src || ''));
        if (dataMatch) {
            var type = dataMatch[1].toLowerCase();
            if (type === 'jpeg' || type === 'jpg') return 'jpg';
            if (type === 'svg+xml') return 'svg';
            if (type === 'webp') return 'webp';
            if (type === 'gif') return 'gif';
            if (type === 'png') return 'png';
        }

        var urlMatch = /\\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(String(src || ''));
        return urlMatch ? urlMatch[1].toLowerCase() : 'png';
    }

    function initSearch() {
        var input = document.querySelector('[data-search-input]');
        if (!input) return;

        input.addEventListener('input', function () {
            runSearch(input.value);
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                jumpSearch(event.shiftKey ? -1 : 1);
            } else if (event.key === 'Escape') {
                setSearchOpen(false);
            }
        });
    }

    function setSearchOpen(open) {
        var search = document.querySelector('.export-search');
        var input = document.querySelector('[data-search-input]');
        var button = document.querySelector('[data-search-toggle]');
        if (!search || !input) return;

        search.hidden = !open;
        if (button) {
            button.classList.toggle('is-active', open);
        }

        if (open) {
            input.focus();
            input.select();
        } else {
            clearSearchMarks();
            setSearchStatus('');
        }
    }

    function runSearch(query) {
        clearSearchMarks();
        var term = String(query || '').trim();
        if (!term) {
            setSearchStatus('');
            return;
        }

        var root = document.querySelector('.html-chat-export');
        if (!root) return;

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue || !node.nodeValue.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.parentElement && node.parentElement.closest('script, style, .export-nav, .export-image-viewer, .export-search-mark')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return node.nodeValue.toLowerCase().includes(term.toLowerCase())
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            },
        });

        var nodes = [];
        var current;
        while ((current = walker.nextNode())) {
            nodes.push(current);
        }

        nodes.forEach(function (node) {
            markTextNode(node, term);
        });

        activeSearchIndex = searchMatches.length ? 0 : -1;
        updateActiveSearchMatch();
    }

    function markTextNode(node, term) {
        var text = node.nodeValue;
        var lowerText = text.toLowerCase();
        var lowerTerm = term.toLowerCase();
        var fragment = document.createDocumentFragment();
        var index = 0;
        var matchIndex = lowerText.indexOf(lowerTerm);

        while (matchIndex !== -1) {
            if (matchIndex > index) {
                fragment.appendChild(document.createTextNode(text.slice(index, matchIndex)));
            }

            var mark = document.createElement('mark');
            mark.className = 'export-search-mark';
            mark.textContent = text.slice(matchIndex, matchIndex + term.length);
            fragment.appendChild(mark);
            searchMatches.push(mark);
            index = matchIndex + term.length;
            matchIndex = lowerText.indexOf(lowerTerm, index);
        }

        if (index < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(index)));
        }

        node.parentNode.replaceChild(fragment, node);
    }

    function clearSearchMarks() {
        searchMatches.forEach(function (mark) {
            var parent = mark.parentNode;
            if (!parent) return;
            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
            parent.normalize();
        });
        searchMatches = [];
        activeSearchIndex = -1;
    }

    function jumpSearch(direction) {
        if (!searchMatches.length) {
            return;
        }

        activeSearchIndex = (activeSearchIndex + direction + searchMatches.length) % searchMatches.length;
        updateActiveSearchMatch();
    }

    function updateActiveSearchMatch() {
        searchMatches.forEach(function (mark, index) {
            mark.classList.toggle('is-active', index === activeSearchIndex);
        });

        if (activeSearchIndex >= 0 && searchMatches[activeSearchIndex]) {
            searchMatches[activeSearchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        setSearchStatus(searchMatches.length
            ? String(activeSearchIndex + 1) + ' / ' + String(searchMatches.length)
            : '\\u672a\\u627e\\u5230');
    }

    function setSearchStatus(text) {
        var status = document.querySelector('[data-search-status]');
        if (status) {
            status.textContent = text;
        }
    }

    function initScrollProgress() {
        var scrollbar = document.querySelector('.export-scrollbar');
        var thumb = document.querySelector('[data-scrollbar-thumb]');
        if (!scrollbar || !thumb) return;

        var dragState = null;

        function getScrollableDistance() {
            return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        }

        function syncThumb() {
            var trackHeight = scrollbar.clientHeight - 4;
            var scrollHeight = Math.max(document.documentElement.scrollHeight, 1);
            var visibleRatio = Math.min(1, window.innerHeight / scrollHeight);
            var thumbHeight = Math.max(42, Math.round(trackHeight * visibleRatio));
            var maxThumbTop = Math.max(0, trackHeight - thumbHeight);
            var scrollDistance = getScrollableDistance();
            var progress = scrollDistance > 0 ? window.scrollY / scrollDistance : 0;

            thumb.style.height = thumbHeight + 'px';
            thumb.style.transform = 'translateY(' + Math.round(maxThumbTop * progress) + 'px)';
            scrollbar.hidden = scrollDistance <= 2;
        }

        function scrollFromPointer(clientY) {
            var rect = scrollbar.getBoundingClientRect();
            var trackHeight = scrollbar.clientHeight - 4;
            var thumbHeight = thumb.offsetHeight || 42;
            var maxThumbTop = Math.max(1, trackHeight - thumbHeight);
            var y = Math.min(Math.max(clientY - rect.top - 2 - thumbHeight / 2, 0), maxThumbTop);
            var progress = y / maxThumbTop;
            window.scrollTo({ top: getScrollableDistance() * progress, behavior: 'auto' });
        }

        scrollbar.addEventListener('pointerdown', function (event) {
            dragState = {
                pointerId: event.pointerId,
            };
            scrollbar.classList.add('is-dragging');
            scrollbar.setPointerCapture(event.pointerId);
            scrollFromPointer(event.clientY);
            event.preventDefault();
        });

        scrollbar.addEventListener('pointermove', function (event) {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            scrollFromPointer(event.clientY);
            event.preventDefault();
        });

        function endDrag() {
            dragState = null;
            scrollbar.classList.remove('is-dragging');
        }

        scrollbar.addEventListener('pointerup', endDrag);
        scrollbar.addEventListener('pointercancel', endDrag);
        window.addEventListener('scroll', syncThumb, { passive: true });
        window.addEventListener('resize', syncThumb);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncThumb);
        }

        syncThumb();
        requestAnimationFrame(syncThumb);
    }

    function downloadExportHtml(html, fileName) {
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function getEditedFileName() {
        var base = (document.title || 'SillyTavern Chat').replace(/\\s+-\\s+\\d+ messages$/, '');
        var timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        return sanitizeFileName(base) + '-edited-' + timestamp + '.html';
    }

    function sanitizeFileName(name) {
        return String(name).replace(/[\\\\/:*?"<>|]+/g, '_').replace(/\\s+/g, ' ').trim().slice(0, 80) || 'SillyTavern Chat';
    }

    function initFloatingNav() {
        var nav = document.querySelector('.export-nav');
        if (!nav) return;

        var toggle = nav.querySelector('.export-nav-toggle');
        var panel = nav.querySelector('.export-nav-panel');
        if (!toggle || !panel) return;

        var dragState = null;
        var suppressClick = false;

        function getPanelWidth() {
            return nav.classList.contains('is-open') ? Math.max(toggle.offsetWidth, panel.offsetWidth || 320) : toggle.offsetWidth;
        }

        function getPanelHeight() {
            return nav.classList.contains('is-open') ? toggle.offsetHeight + 8 + (panel.offsetHeight || 0) : toggle.offsetHeight;
        }

        function clampNumber(value, min, max) {
            if (max < min) return min;
            return Math.min(Math.max(value, min), max);
        }

        function setNavPosition(left, top) {
            var viewport = getVisualViewportBox();
            var margin = document.body.classList.contains('html-chat-export-mobile') ? 10 : 12;
            var width = dragState ? toggle.offsetWidth : getPanelWidth();
            var height = dragState ? toggle.offsetHeight : getPanelHeight();
            var minLeft = viewport.left + margin;
            var minTop = viewport.top + margin;
            var maxLeft = viewport.left + viewport.width - width - margin;
            var maxTop = viewport.top + viewport.height - height - margin;

            nav.style.left = clampNumber(left, minLeft, maxLeft) + 'px';
            nav.style.top = clampNumber(top, minTop, maxTop) + 'px';
            nav.style.right = 'auto';
        }

        function clampNavPosition() {
            var rect = nav.getBoundingClientRect();
            setNavPosition(rect.left, rect.top);
        }

        function setOpen(open) {
            nav.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            clampNavPosition();
        }

        toggle.addEventListener('click', function (event) {
            if (suppressClick) {
                event.preventDefault();
                suppressClick = false;
                return;
            }

            setOpen(!nav.classList.contains('is-open'));
        });

        toggle.addEventListener('pointerdown', function (event) {
            if (event.button !== 0) return;

            var rect = nav.getBoundingClientRect();
            var toggleRect = toggle.getBoundingClientRect();
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                offsetX: event.clientX - toggleRect.left,
                offsetY: event.clientY - toggleRect.top,
                left: rect.left,
                top: rect.top,
                moved: false,
            };
            toggle.setPointerCapture(event.pointerId);
        });

        toggle.addEventListener('pointermove', function (event) {
            if (!dragState || dragState.pointerId !== event.pointerId) return;

            var deltaX = event.clientX - dragState.startX;
            var deltaY = event.clientY - dragState.startY;
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                dragState.moved = true;
                nav.classList.add('is-dragging');
                if (nav.classList.contains('is-open')) {
                    setOpen(false);
                }
            }

            if (dragState.moved) {
                event.preventDefault();
                setNavPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
            }
        });

        toggle.addEventListener('pointerup', function (event) {
            if (!dragState || dragState.pointerId !== event.pointerId) return;

            if (dragState.moved) {
                suppressClick = true;
            }
            nav.classList.remove('is-dragging');
            dragState = null;
        });

        toggle.addEventListener('pointercancel', function () {
            nav.classList.remove('is-dragging');
            dragState = null;
        });

        function handleViewportChange() {
            syncReaderViewport();
            clampNavPosition();
        }

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('orientationchange', handleViewportChange);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportChange);
            window.visualViewport.addEventListener('scroll', handleViewportChange);
        }
        nav.addEventListener('toggle', clampNavPosition, true);
        requestAnimationFrame(clampNavPosition);
    }

    function expandChapter(chapter) {
        if (chapter) {
            chapter.classList.remove('is-collapsed');
        }
    }

    function highlight(element) {
        if (!element) return;
        element.classList.remove('export-highlight');
        void element.offsetWidth;
        element.classList.add('export-highlight');
    }

    function jumpToElement(element) {
        if (!element) return;
        expandChapter(element.closest('.export-chapter'));
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        highlight(element);
    }

    function toggleTavernHelperCodeBlock(button) {
        var block = button.nextElementSibling;
        if (!(block instanceof HTMLPreElement)) return false;

        var isHidden = getComputedStyle(block).display === 'none';
        block.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
        button.dataset.exportExpanded = isHidden ? '1' : '0';
        button.setAttribute('aria-expanded', String(isHidden));
        button.textContent = isHidden ? '\u9690\u85cf\u524d\u7aef\u4ee3\u7801\u5757' : '\u663e\u793a\u524d\u7aef\u4ee3\u7801\u5757';
        return true;
    }

    document.addEventListener('click', function (event) {
        var tavernHelperCodeToggle = event.target.closest('.TH-collapse-code-block-button');
        if (tavernHelperCodeToggle && toggleTavernHelperCodeBlock(tavernHelperCodeToggle)) {
            event.preventDefault();
            return;
        }

        var editorToggle = event.target.closest('[data-editor-toggle]');
        if (editorToggle) {
            setEditMode(!document.body.classList.contains('export-edit-mode'));
            return;
        }

        var saveCopy = event.target.closest('[data-save-copy]');
        if (saveCopy) {
            saveEditedHtmlCopy();
            return;
        }

        var searchToggle = event.target.closest('[data-search-toggle]');
        if (searchToggle) {
            setSearchOpen(!document.querySelector('.export-search') || document.querySelector('.export-search').hidden);
            return;
        }

        var fontCycle = event.target.closest('[data-font-cycle]');
        if (fontCycle) {
            cycleFontScale();
            return;
        }

        var searchPrev = event.target.closest('[data-search-prev]');
        if (searchPrev) {
            jumpSearch(-1);
            return;
        }

        var searchNext = event.target.closest('[data-search-next]');
        if (searchNext) {
            jumpSearch(1);
            return;
        }

        var applyFavorites = event.target.closest('[data-apply-favorites]');
        if (applyFavorites) {
            applyFavoritesEditor();
            return;
        }

        var applyChapters = event.target.closest('[data-apply-chapters]');
        if (applyChapters) {
            applyChaptersEditor();
            return;
        }

        var favoriteToggle = event.target.closest('[data-toggle-favorite-floor]');
        if (favoriteToggle) {
            toggleFavorite(Number(favoriteToggle.dataset.toggleFavoriteFloor));
            return;
        }

        var favoriteCancel = event.target.closest('[data-favorite-picker-cancel]');
        if (favoriteCancel) {
            closeFavoritePicker();
            return;
        }

        var favoriteConfirm = event.target.closest('[data-favorite-picker-confirm]');
        if (favoriteConfirm) {
            confirmFavoritePicker();
            return;
        }

        var chapterToggle = event.target.closest('[data-chapter-toggle]');
        if (chapterToggle) {
            var chapter = chapterToggle.closest('.export-chapter');
            if (chapter) {
                chapter.classList.toggle('is-collapsed');
            }
            return;
        }

        var floorJump = event.target.closest('[data-jump-floor]');
        if (floorJump) {
            jumpToElement(document.getElementById('mes-' + floorJump.dataset.jumpFloor));
            return;
        }

        var chapterJump = event.target.closest('[data-jump-chapter]');
        if (chapterJump) {
            var targetChapter = document.getElementById('chapter-' + chapterJump.dataset.jumpChapter);
            expandChapter(targetChapter);
            jumpToElement(targetChapter ? targetChapter.querySelector('.mes') : null);
        }
    });

    initReaderViewport();
    hydrateAssets();
    initSnapshotFrames();
    initEditableReader();
    initImageViewer();
    initSearch();
    initFontScaleControls();
    initMobileContentScaling();
    initScrollProgress();
    initFloatingNav();
})();
`;
    }

    async function collectReadableStyles(exportTask) {
        const imports = [];
        const chunks = [];
        const capturedImports = new Set();
        const capturedCss = new Set();
        const capturedSheets = new Set();

        for (const sheet of Array.from(document.styleSheets)) {
            throwIfExportCancelled(exportTask);
            if (sheet.disabled || capturedSheets.has(sheet)) {
                continue;
            }

            try {
                const rules = Array.from(sheet.cssRules || []);
                if (!rules.length) {
                    continue;
                }

                for (const rule of rules) {
                    if (rule.type === CSSRule.IMPORT_RULE) {
                        appendUniqueCss(imports, capturedImports, absolutizeCssUrls(rule.cssText, sheet.href || location.href));
                    }
                }

                let css = rules
                    .filter(rule => rule.type !== CSSRule.IMPORT_RULE)
                    .map(rule => rule.cssText)
                    .join('\n');
                css = absolutizeCssUrls(css, sheet.href || location.href);
                appendUniqueCss(chunks, capturedCss, css);
                capturedSheets.add(sheet);
            } catch {
                const owner = sheet.ownerNode;
                if (owner instanceof HTMLLinkElement && owner.href) {
                    appendUniqueCss(imports, capturedImports, `@import url("${escapeCssString(owner.href)}");`);
                    capturedSheets.add(sheet);
                }
            }
        }

        for (const styleElement of document.querySelectorAll('style')) {
            throwIfExportCancelled(exportTask);
            if (styleElement.sheet && capturedSheets.has(styleElement.sheet)) {
                continue;
            }

            const css = styleElement.textContent?.trim();
            if (css) {
                appendUniqueCss(chunks, capturedCss, absolutizeCssUrls(css, location.href));
            }
        }

        return imports.concat(chunks).join('\n\n');
    }

    function appendUniqueCss(chunks, capturedCss, css) {
        if (!css || capturedCss.has(css)) {
            return;
        }

        capturedCss.add(css);
        chunks.push(css);
    }

    function absolutizeCssUrls(cssText, baseUrl) {
        return cssText.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (fullMatch, quote, rawUrl) => {
            const value = rawUrl?.trim();
            if (!value || value.startsWith('data:') || value.startsWith('#')) {
                return fullMatch;
            }

            try {
                return `url("${escapeCssString(new URL(value, baseUrl).href)}")`;
            } catch {
                return fullMatch;
            }
        });
    }

    async function fetchWithTimeout(url, exportTask) {
        throwIfExportCancelled(exportTask);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
        const onAbort = () => controller.abort();
        exportTask?.signal?.addEventListener('abort', onAbort, { once: true });

        try {
            return await fetch(url, {
                cache: 'force-cache',
                signal: controller.signal,
            });
        } finally {
            exportTask?.signal?.removeEventListener('abort', onAbort);
            clearTimeout(timeout);
        }
    }

    function enableSelectionMode() {
        const chat = document.querySelector('#chat');
        if (!chat) {
            notify('\u6ca1\u6709\u627e\u5230\u804a\u5929\u533a\u57df\u3002', 'warning');
            return;
        }

        chat.classList.add(selectModeClass);
        const messages = Array.from(chat.querySelectorAll(':scope > .mes'));

        for (const message of messages) {
            if (message.querySelector(`.${checkboxClass}`)) {
                continue;
            }

            const mesId = message.getAttribute('mesid') || '';
            const label = document.createElement('label');
            label.className = checkboxClass;
            label.innerHTML = `<input type="checkbox" checked><span>#${escapeHtml(mesId)}</span>`;
            const checkbox = label.querySelector('input');
            checkbox.addEventListener('change', () => {
                message.classList.toggle(selectedClass, checkbox.checked);
                updateSelectionButtons();
            });
            message.prepend(label);
            message.classList.add(selectedClass);
        }

        updateSelectionButtons();
        setStatus(`\u5df2\u8fdb\u5165\u81ea\u5b9a\u4e49\u52fe\u9009\u6a21\u5f0f\uff1a\u9ed8\u8ba4\u9009\u4e2d ${messages.length} \u4e2a\u697c\u5c42\u3002`);
    }

    function disableSelectionMode() {
        const chat = document.querySelector('#chat');
        if (!chat) {
            return;
        }

        chat.classList.remove(selectModeClass);
        chat.querySelectorAll(`.${checkboxClass}`).forEach(element => element.remove());
        chat.querySelectorAll(`.${selectedClass}`).forEach(element => element.classList.remove(selectedClass));
        updateSelectionButtons();
        setStatus('\u5bfc\u51fa\u8303\u56f4\uff1a\u5f53\u524d\u9875\u9762\u5df2\u7ecf\u6e32\u67d3\u51fa\u6765\u7684\u804a\u5929\u697c\u5c42\u3002');
    }

    function toggleAllSelectedMessages() {
        const checkboxes = Array.from(document.querySelectorAll(`#chat .${checkboxClass} input[type="checkbox"]`));
        if (!checkboxes.length) {
            return;
        }

        const shouldSelect = checkboxes.some(checkbox => !checkbox.checked);
        for (const checkbox of checkboxes) {
            checkbox.checked = shouldSelect;
            checkbox.closest('.mes')?.classList.toggle(selectedClass, shouldSelect);
        }

        updateSelectionButtons();
        setStatus(shouldSelect
            ? `\u5df2\u5168\u9009 ${checkboxes.length} \u4e2a\u697c\u5c42\u3002`
            : '\u5df2\u53d6\u6d88\u5168\u9009\u3002');
    }

    function updateSelectionButtons() {
        const inSelectionMode = Boolean(document.querySelector(`#chat .${checkboxClass}`));
        const selectionCheckboxes = document.querySelectorAll(`#chat .${checkboxClass} input[type="checkbox"]`);
        const selectedCount = document.querySelectorAll(`#chat .${checkboxClass} input:checked`).length;
        const totalCount = selectionCheckboxes.length;

        const exportSelected = document.getElementById(`${extensionId}-export-selected`);
        const toggleSelectAll = document.getElementById(`${extensionId}-toggle-select-all`);
        const cancelSelect = document.getElementById(`${extensionId}-cancel-select`);

        if (exportSelected) {
            exportSelected.disabled = !inSelectionMode || selectedCount === 0;
            exportSelected.value = inSelectionMode ? `\u5bfc\u51fa\u5df2\u52fe\u9009 (${selectedCount})` : '\u5bfc\u51fa\u5df2\u52fe\u9009';
        }

        if (toggleSelectAll) {
            toggleSelectAll.disabled = !inSelectionMode;
            toggleSelectAll.value = selectedCount === totalCount && totalCount > 0 ? '\u53d6\u6d88\u5168\u9009' : '\u5168\u9009';
        }

        if (cancelSelect) {
            cancelSelect.disabled = !inSelectionMode;
        }
    }

    function setButtonsDisabled(ids, disabled) {
        for (const id of ids) {
            const button = document.getElementById(id);
            if (button) {
                button.disabled = disabled;
            }
        }
    }

    function downloadHtmlFile(html, fileName) {
        downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), fileName);
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function getExportFileName() {
        const context = window.SillyTavern?.getContext?.();
        const base = context?.chatId || document.title || 'SillyTavern Chat';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        return `${sanitizeFileName(String(base).replace(/\.jsonl$/i, ''))}-${timestamp}.html`;
    }

    function getDocumentTitle(messageCount) {
        const context = window.SillyTavern?.getContext?.();
        const chatId = context?.chatId ? String(context.chatId).replace(/\.jsonl$/i, '') : document.title;
        return `${chatId || 'SillyTavern Chat'} - ${messageCount} messages`;
    }

    function sanitizeFileName(name) {
        return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'SillyTavern Chat';
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll('\'', '&#39;');
    }

    function escapeCssString(value) {
        return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    }

    function escapeScriptJson(value) {
        return JSON.stringify(value).replaceAll('</', '<\\/');
    }

    function styleObjectToCss(styles, indent = '') {
        return Object.entries(styles)
            .map(([property, value]) => `${indent}${property}: ${value};`)
            .join('\n');
    }

    async function inlineCssUrls(cssText, cache = new Map(), baseUrl = location.href, exportTask) {
        const matches = Array.from(cssText.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g));
        let failed = 0;

        const replacements = await mapWithConcurrency(matches, assetFetchConcurrency, async match => {
            throwIfExportCancelled(exportTask);

            const fullMatch = match[0];
            const rawUrl = match[2]?.trim();
            if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('#')) {
                return null;
            }

            try {
                const absoluteUrl = new URL(rawUrl, baseUrl).href;
                const dataUrl = await getAssetDataUrl(absoluteUrl, cache, exportTask);
                return {
                    fullMatch,
                    replacement: `url("${escapeCssString(dataUrl)}")`,
                };
            } catch (error) {
                if (isExportCancelled(error, exportTask)) {
                    throw error;
                }

                failed++;
                console.warn('[拾玉-HTML导出] failed to inline CSS asset:', rawUrl, error);
                return null;
            }
        });

        const replacementByMatch = new Map();
        for (const replacement of replacements) {
            if (replacement) {
                replacementByMatch.set(replacement.fullMatch, replacement.replacement);
            }
        }

        const result = replacementByMatch.size > 0
            ? cssText.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, fullMatch => replacementByMatch.get(fullMatch) ?? fullMatch)
            : cssText;

        return {
            cssText: result,
            failed,
        };
    }

    async function mapWithConcurrency(items, concurrency, worker) {
        const results = new Array(items.length);
        let nextIndex = 0;

        async function runWorker() {
            while (nextIndex < items.length) {
                const index = nextIndex++;
                results[index] = await worker(items[index], index);
            }
        }

        const workerCount = Math.min(concurrency, items.length);
        await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
        return results;
    }

    function isTransparentColor(value) {
        return value === 'transparent' || value === 'rgba(0, 0, 0, 0)' || value === 'rgb(0 0 0 / 0)';
    }

    function cleanExportClassName(value) {
        return String(value)
            .split(/\s+/)
            .map(className => className.trim())
            .filter(Boolean)
            .filter(className => className !== selectModeClass && !className.startsWith(`${extensionId}-`))
            .join(' ');
    }

    function nextFrame() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function nextAnimationFrame() {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    function setStatus(message) {
        const status = document.getElementById(`${extensionId}-status`);
        if (status) {
            status.textContent = message;
        }
    }

    function notify(message, type = 'success') {
        if (window.toastr?.[type]) {
            window.toastr[type](message);
        } else if (window.toastr?.info) {
            window.toastr.info(message);
        } else {
            console.log(`[拾玉-HTML导出] ${message}`);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
