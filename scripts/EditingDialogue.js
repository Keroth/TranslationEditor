import {MODULE_ID, TRANSLATION} from "./settings.js"
import {logger} from "./Logger.js";

export class EditingDialogue extends FormApplication {

    /** @var {{string: {name: string, languages: {lang: string, name: string, path: string}[], translations: {string: {translations: {}}}}}} TRANSLATIONS */
    static TRANSLATIONS = {}

    currentModuleLanguages = []

    get title() {
        return game.i18n.localize(TRANSLATION.DIALOGUE.title)
    }

    async _updateObject(event, formData) {
        return Promise.resolve(undefined)
    }

    static get defaultOptions() {
        const options = super.defaultOptions
        options.id = `${MODULE_ID}-editor`
        options.template = `modules/${MODULE_ID}/templates/editor.hbs`
        options.width = 1000
        options.height = 500
        options.resizable = true

        return options
    }

    // noinspection JSCheckFunctionSignatures
    getData(options = {}) {
        // noinspection JSValidateTypes
        return {
            "modules": EditingDialogue.TRANSLATIONS
        }
    }

    /**
     * Change the state of the module select and the loading icon.
     */
    static toggleSelect() {
        const editor = $('#translation-editor-editor')
        const select = editor.find('select.moduleList')
        const loadingIcon = editor.find('i.loadingIcon')
        if (select.hasClass("disabled")) {
            select.removeClass('disabled').attr('disabled', false)
            loadingIcon.addClass('hidden')
            editor.find('table').removeClass('hidden')
        } else {
            select.addClass('disabled').attr('disabled', true)
            loadingIcon.removeClass('hidden')
        }
    }


    /**
     * @param {Object} module
     * @returns {[{string: {translations: {language: string, text: string}}}, int]}
     */
    static async loadTranslationsForModule(module) {
        logger.info(`Loading translations for ${module.id}.`)
        const languages = module.languages
        let out = {}
        if (languages.size > 0) {
            await Promise.all(languages.map(async (language) => {
                let request = await fetch(language.path)
                let languageData = await request.json()
                // noinspection JSUnresolvedFunction
                languageData = flattenObject(languageData)
                logger.debug(languageData)
                for (let languageDataKey in languageData) {
                    if (!languageData.hasOwnProperty(languageDataKey)) {
                        continue
                    }
                    if (typeof out[languageDataKey] === "undefined") {
                        out[languageDataKey] = {
                            translations: {}
                        }
                    }
                    out[languageDataKey].translations[language.lang] = languageData[languageDataKey]
                }
            }))
        }

        return [out, languages]
    }

    static async loadTranslations() {
        game.modules.forEach((async (module) => {
            if (module.active) {
                // noinspection ES6RedundantAwait
                let [translationsForModule, languages] = await EditingDialogue.loadTranslationsForModule(module)
                logger.debug('name:$(module.data.title)\ndata:\n$(Object.keys(translationsForModule))\n\n\nSize:$(Object.keys(translationsForModule).size)\n\n----------------')
                if (Object.keys(translationsForModule).size > 0) {
                    this.TRANSLATIONS[module.id] = {
                        name: module.data.title,
                        languages: languages,
                        translations: translationsForModule
                    }
                }
            }
        }))
    }

    async displayTranslationsForModule(moduleId) {
        logger.info(`Loading translation data for module ${moduleId}.`)
        let form = $('#te-form')
        EditingDialogue.toggleSelect()
        const data = EditingDialogue.TRANSLATIONS[moduleId]
        if (!data) {
            logger.error(`Tried to fetch translations for unknown moduleId ${moduleId}.`)
            EditingDialogue.toggleSelect()
            form.data('unsavedData', false)
            return
        }
        let languages = data.languages
        let fromLanguage = '', toLanguage = ''
        const systemLanguage = game.i18n.lang

        let fromLanguageSelect = $('#te-fromLanguage')
        let toLanguageSelect = $('#te-toLanguage')
        fromLanguageSelect.empty()
        toLanguageSelect.empty()

        for (let language in languages) {
            if (!languages.hasOwnProperty(language)) {
                continue
            }
            let languageData = languages[language]
            if (languageData.lang === systemLanguage) {
                fromLanguage = languageData
            }

            // noinspection JSCheckFunctionSignatures
            fromLanguageSelect.append(`<option value="${languageData.lang}">${languageData.name}</option>`)
            // noinspection JSCheckFunctionSignatures
            toLanguageSelect.append(`<option value="${languageData.lang}">${languageData.name}</option>`)
        }

        if (fromLanguage.size === 0) {
            fromLanguage = languages[0]
            toLanguage = languages.size > 1 ? languages[1] : languages[0]
        } else {
            toLanguage = languages.size > 1 ? (languages[0].lang !== fromLanguage.lang ? languages[0] : languages[1]) : fromLanguage
        }

        fromLanguageSelect.val(fromLanguage.lang)
        toLanguageSelect.val(toLanguage.lang)

        fromLanguageSelect.find('option:selected').addClass('lastSelected')
        toLanguageSelect.find('option:selected').addClass('lastSelected')

        let tableHead = '<tr>'
        tableHead += `<th>${game.i18n.localize(TRANSLATION.CONFIG.editor["translation-key"])}</th>`
        tableHead += `<th>${languages.filter(l => l.lang === fromLanguage.lang)[0].name}</th>`
        tableHead += `<th>${languages.filter(l => l.lang === toLanguage.lang)[0].name}</th>`
        tableHead += '</tr>'

        let tableBody = ''
        let translationData = data.translations
        for (let translationKey in translationData) {
            if (!translationData.hasOwnProperty(translationKey)) {
                continue
            }
            let translations = translationData[translationKey].translations
            tableBody += `<tr data-translationkey="${translationKey}">`
            tableBody += `<td>${translationKey}</td>`
            if (translations.hasOwnProperty(fromLanguage.lang)) {
                tableBody += `<td><span class="fromText">${translations[fromLanguage.lang]}</span><span class="characterCount">(${translations[fromLanguage.lang].size ?? 0})</span></td>`
            } else {
                tableBody += '<td><span class="fromText"></span><span class="characterCount">(0)</span></td>'
            }

            if (translations.hasOwnProperty(toLanguage.lang)) {
                tableBody += `<td><textarea>${translations[toLanguage.lang]}</textarea><span class="characterCount">(${translations[toLanguage.lang].size ?? 0})</span></td>`
            } else {
                tableBody += '<td><textarea></textarea><span class="characterCount">(0)</span></td>'
            }

            tableBody += '</tr>'
        }

        let table = $('#te-form table')
        table.find('> thead').html(tableHead)
        table.find('> tbody').html(tableBody)

        this.currentModuleLanguages = languages.map((l) => {
            l.fromLanguage = l.lang === fromLanguage.lang
            l.toLanguage = l.lang === toLanguage.lang
            return l
        })


        logger.info('Finished updating table.')
        EditingDialogue.toggleSelect()
        form.data('unsavedData', false)
    }

    async reloadLanguage(type) {
        $('#te-form').data('unsavedData', false)
        const moduleId = $('select.moduleList').val()
        if (!moduleId) {
            logger.error('Could not get selected moduleId from select!')
            return
        }

        let select, column
        if (type === 'from') {
            select = $('select#te-fromLanguage')
            column = 2
        } else if (type === 'to') {
            select = $('select#te-toLanguage')
            column = 3
        } else {
            logger.error('Could not determine the selected language!')
            return
        }

        const languageKey = select.val()
        if (!languageKey) {
            logger.error('Could not get selected language from select!')
            return
        }

        let tableBody = $('#te-form > table > tbody')
        let translationsForModule = EditingDialogue.TRANSLATIONS[moduleId].translations
        let translationData, cell, textInLanguage
        for (let translationsKey in translationsForModule) {
            translationData = translationsForModule[translationsKey].translations
            cell = tableBody.find(`> tr[data-translationkey="${translationsKey}"] > td:nth-of-type(${column})`)
            if (translationData.hasOwnProperty(languageKey)) {
                textInLanguage = translationData[languageKey]
            } else {
                textInLanguage = ''
            }
            if (type === 'to') {
                cell.find('> textarea').val(textInLanguage)
            } else {
                cell.find('span').text(textInLanguage)
            }
            cell.find('> span.characterCount').html(`(${textInLanguage.size})`)
            logger.debug(translationData)
        }
    }

    async filterTranslations(searchTerm) {
        searchTerm = searchTerm.trim().toLowerCase()
        $('#te-form table tbody > tr').each((_, row) => {
            let textInRow = $(row).text().toLowerCase()
            if (textInRow.indexOf(searchTerm) > -1) {
                $(row).removeClass('hidden')
            } else {
                $(row).addClass('hidden')
            }
        })
    }

    /**
     * @param {File} file
     * @param {string} moduleId
     * @returns {Promise<void>}
     */
    async saveToFile(file, moduleId) {
        const filePath = `translation-files/${moduleId}`
        try {
            await FilePicker.createDirectory('data', filePath)
        } catch (e) {
            if (!e.startsWith('EEXIST')) {
                console.error(e)
            }
        }
        try {
            await FilePicker.upload('data', filePath, file)
        } catch (e) {
            ui.notifications.error(`Error while saving the file to ${filePath}`)
            logger.error(e)
        }
    }

    /**
     * @param {boolean} isDownload
     * @returns {Promise<void>}
     */
    async saveTranslations(isDownload = false) {
        const moduleId = $('select.moduleList').val()
        const targetLanguage = $('#te-toLanguage').val()
        const saveNested = $('select#te-saveType').val() === 'nested'
        let rawData = $('#te-form tbody > tr > td:nth-of-type(3) > textarea')

        logger.info(`Saving translations for module ${moduleId} in language ${targetLanguage}`)
        let dataAsObject = {}
        rawData.each((_, textarea) => {
            dataAsObject[$(textarea).parent().parent().data('translationkey')] = textarea.value
        })

        let finalData
        if (saveNested) {
            // noinspection JSUnresolvedFunction
            finalData = expandObject(dataAsObject)
        } else {
            finalData = dataAsObject
        }

        logger.info('Finalized the data to be saved')
        logger.debug(finalData)

        let targetLanguageData = EditingDialogue.TRANSLATIONS[moduleId].languages.filter(l => l.lang === targetLanguage)
        if (targetLanguageData.size === 1) {
            let fileContent = JSON.stringify(finalData, null, 4)
            if (isDownload) {
                saveDataToFile(fileContent, "text/json", `${moduleId}-${targetLanguage}.json`);
            } else {
                let file = new File([new Blob([fileContent], {type: 'application/json'})], `${targetLanguage}.json`, {type: 'application/json'})
                await this.saveToFile(file, moduleId)
            }
        }
    }

    /**
     * @param {function} accept
     * @param {function} reject
     */
    warnForUnsavedChanges(accept, reject = () => {}) {
        Dialog.confirm({
            title: game.i18n.localize(TRANSLATION.CONFIG.editor["unsaved-changes"].question),
            content: game.i18n.localize(TRANSLATION.CONFIG.editor["unsaved-changes"].text),
            yes: accept,
            no: reject,
            rejectClose: true
        }).then()
    }

    activateListeners(html) {
        super.activateListeners(html)
        let instance = this
        let moduleSelect = $('#translation-editor-editor').find('select.moduleList')
        let form = $('#te-form')
        form.data('unsavedData', false)

        moduleSelect.on('change', async function () {
            if (form.data('unsavedData') === true) {
                instance.warnForUnsavedChanges(() => {
                    instance.displayTranslationsForModule($(this).val()).then()
                }, () => {
                    moduleSelect.val(moduleSelect.find('option.lastSelected').val())
                })
            } else {
                await instance.displayTranslationsForModule($(this).val())
                moduleSelect.find('option').removeClass('lastSelected')
                moduleSelect.find('option:selected').addClass('lastSelected')
                form.data('unsavedData', false)
            }
        })

        html.find('select#te-fromLanguage').on('change', async function () {
            if (form.data('unsavedData') === true) {
                instance.warnForUnsavedChanges(() => {
                    instance.reloadLanguage('from').then()
                }, async () => {
                    $(this).val($(this).find('option.lastSelected').val())
                })
            } else {
                await instance.reloadLanguage('from')
                $(this).find('option').removeClass('lastSelected')
                $(this).find('option:selected').addClass('lastSelected')
                form.data('unsavedData', false)
            }
        })

        html.find('select#te-toLanguage').on('change', async function () {
            if (form.data('unsavedData') === true) {
                instance.warnForUnsavedChanges(() => {
                    instance.reloadLanguage('to').then()
                }, async () => {
                    $(this).val($(this).find('option.lastSelected').val())
                })
            } else {
                await instance.reloadLanguage('to')
                $(this).find('option').removeClass('lastSelected')
                $(this).find('option:selected').addClass('lastSelected')
            }
        })

        html.find('table > tbody').on('keyup', '> tr > td > textarea', function () {
            $(this).find('+ span.characterCount').html(`(${$(this).val().size})`)
            form.data('unsavedData', true)
        })

        html.find('button.resetButton').on('click', async function () {
            event.preventDefault()
            if (form.data('unsavedData') === true) {
                instance.warnForUnsavedChanges(() => {
                    instance.reloadLanguage('from').then()
                    instance.reloadLanguage('to').then()
                })
            } else {
                await instance.displayTranslationsForModule(moduleSelect.val())
            }
        })

        html.find('button.saveButton').on('click', async function () {
            event.preventDefault()
            await instance.saveTranslations()
        })

        html.find('button.downloadButton').on('click', async function () {
            event.preventDefault()
            await instance.saveTranslations(true)
        })

        html.find('input#te-search').on('keyup', async function () {
            await instance.filterTranslations($(this).val())
        })

        instance.displayTranslationsForModule(moduleSelect.val()).then()
    }

}
