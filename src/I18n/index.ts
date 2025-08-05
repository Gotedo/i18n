/*
 * @adonisjs/i18n
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import { EmitterContract } from '@ioc:Adonis/Core/Event'
import {
  I18nContract,
  I18nManagerContract,
  ValidatorWildcardCallback,
  type TranslationsFormatterContract,
} from '@ioc:Adonis/Addons/I18n'
import { Formatter } from '../Formatters/Core'
import get from 'lodash.get'

/**
 * I18n class works with a dedicated locale at a given point
 * in time
 */
export class I18n extends Formatter implements I18nContract {
  /**
   * Locale translations
   */
  private localeTranslations: Record<string, string>
  private rawLocaleTranslations: Record<string, string | Record<string, string>>

  /**
   * Fallback translations
   */
  private fallbackTranslations: Record<string, string>
  private rawFallbackTranslations: Record<string, string | Record<string, string>>

  /**
   * The fallback locale for the current instance.
   */
  public get fallbackLocale() {
    return this.i18nManager.getFallbackLocale(this.locale)
  }

  constructor(
    public locale: string,
    private emitter: EmitterContract,
    private logger: LoggerContract,
    private i18nManager: I18nManagerContract
  ) {
    super(locale)
  }

  /**
   * Load translations from the i18nManager. Note, this method doesn't load
   * translations from the configured loaders. It just asks the i18nManager
   * to return cached translations for the selected locale.
   */
  private loadTranslations() {
    const translations = this.i18nManager.getTranslationsFor(this.locale)
    this.localeTranslations = translations['flattened'] || {}
    this.rawLocaleTranslations = translations['raw'] || {}

    const fallbackTranslations = this.i18nManager.getTranslationsFor(this.fallbackLocale)
    this.fallbackTranslations = fallbackTranslations['flattened'] || {}
    this.rawFallbackTranslations = fallbackTranslations['raw'] || {}
  }

  /**
   * Lazy load translations. Doing this as i18n class usually results in switchLocale
   * during real world use cases
   */
  private lazyLoadTranslations() {
    if (
      (!this.localeTranslations && !this.fallbackTranslations) ||
      (!this.rawLocaleTranslations && !this.rawFallbackTranslations)
    ) {
      this.loadTranslations()
    }
  }

  /**
   * Emits the missing translation message
   */
  private notifyForMissingTranslation(identifier: string, hasFallback: boolean) {
    this.emitter.emit('i18n:missing:translation', {
      locale: this.locale,
      identifier,
      hasFallback,
    })
  }

  /**
   * Returns the message for a given identifier
   */
  private getMessage(
    identifier: string,
    returnObject: boolean
  ): { message: string | Record<string, string>; isFallback: boolean } | null {
    let message: string | Record<string, string>

    /**
     * Return the translation (if exists)
     */
    if (returnObject) {
      message = get(this.rawLocaleTranslations, identifier)
      if (message) {
        return {
          message,
          isFallback: false,
        }
      }
    } else {
      message = this.localeTranslations[identifier]
      if (message) {
        return { message, isFallback: false }
      }
    }

    /**
     * Look for translation inside the fallback messages
     */
    if (returnObject) {
      message = get(this.rawFallbackTranslations, identifier)
      if (message) {
        return {
          message,
          isFallback: true,
        }
      }
    } else {
      message = this.fallbackTranslations[identifier]
      if (message) {
        return { message, isFallback: true }
      }
    }

    return null
  }

  /**
   * Formats the validator message (if exists) otherwise returns null
   */
  private formatValidatorMessage(
    identifier: string,
    data: Record<string, string>,
    forceNotify = false
  ): string | null {
    const message = this.getMessage(identifier, false)

    /**
     * Return early when there is no message available
     */
    if (!message) {
      if (forceNotify) {
        this.notifyForMissingTranslation(identifier, false)
      }
      return null
    }

    /**
     * Notify when a fallback is available but the main language
     * message is missing
     */
    if (message.isFallback) {
      this.notifyForMissingTranslation(identifier, message?.isFallback || false)
    }

    return this.formatRawMessage(message.message, data)
  }

  /**
   * Returns a boolean identifying if the message for a given
   * identifier exists or not
   */
  public hasMessage(identifier: string): boolean {
    this.lazyLoadTranslations()
    return this.localeTranslations[identifier] !== undefined
  }

  /**
   * Returns a boolean identifying if a fallback message for a given
   * identifier exists or not
   */
  public hasFallbackMessage(identifier: string): boolean {
    this.lazyLoadTranslations()
    return this.fallbackTranslations[identifier] !== undefined
  }

  /**
   * Switch locale for the current instance
   */
  public switchLocale(locale: string) {
    this.locale = locale
    this.logger.debug('switching locale to "%s"', this.locale)
    this.loadTranslations()
  }

  /**
   * Returns a wildcard function to format validation
   * failure messages
   */
  public validatorMessages(messagesPrefix: string = 'validator.shared'): {
    '*': ValidatorWildcardCallback
  } {
    return {
      '*': (field, rule, arrayExpressionPointer, options) => {
        this.lazyLoadTranslations()
        const data = { field, rule, ...options }

        /**
         * The first priority is give to the field + rule message.
         */
        const fieldRuleMessage = this.formatValidatorMessage(
          `${messagesPrefix}.${field}.${rule}`,
          data
        )
        if (fieldRuleMessage) {
          return fieldRuleMessage
        }

        /**
         * If array expression pointer exists, then the 2nd priority
         * is given to the array expression pointer
         */
        if (arrayExpressionPointer) {
          const arrayRuleMessage = this.formatValidatorMessage(
            `${messagesPrefix}.${arrayExpressionPointer}.${rule}`,
            data
          )
          if (arrayRuleMessage) {
            return arrayRuleMessage
          }
        }

        /**
         * Find if there is a message for the validation rule
         */
        const ruleMessage = this.formatValidatorMessage(`${messagesPrefix}.${rule}`, data, true)
        if (ruleMessage) {
          return ruleMessage
        }

        /**
         * Otherwise fallback to a standard english string
         */
        return `${rule} validation failed on ${field}`
      },
    }
  }

  private resolveContextIdentifier(identifier: string, context?: string): string {
    if (!context) {
      return identifier
    }
    return `${identifier}_${context.toLocaleLowerCase()}`
  }

  private resolvePluralIdentifier(
    identifier: string,
    count?: number | string
  ): string | { missingKey: string; expectedFallbackIdentifier?: string } {
    if (typeof count === 'undefined') {
      return identifier
    }

    if (typeof count === 'string') {
      count = Number(count)
      if (isNaN(count)) {
        throw new Error('"count" is not an number')
      }
    }

    let pluralConfig = this.i18nManager.config.plurals
    pluralConfig = Object.entries(pluralConfig || {}).reduce((prev, [key, value]) => {
      prev[key] = value.toLocaleLowerCase()
      return prev
    }, {})

    const existingIdentifierPlurals: typeof pluralConfig = Object.values(pluralConfig || {}).reduce(
      (prev, cur) => {
        const currentIdentifier = `${identifier}_${cur}`
        if (this.localeTranslations[currentIdentifier]) {
          prev[cur] = currentIdentifier
        }
        return prev
      },
      {}
    )

    const expectedFallbackIdentifier = `${identifier}_${pluralConfig['other']}`

    function getFallback(missingKey: string) {
      if (existingIdentifierPlurals[pluralConfig!['other']!]) {
        return expectedFallbackIdentifier
      }
      return {
        missingKey,
        expectedFallbackIdentifier,
      }
    }

    if (count === 0) {
      if (existingIdentifierPlurals[pluralConfig['zero']!]) {
        return `${identifier}_${pluralConfig['zero']}`
      } else {
        return { missingKey: `${identifier}_${pluralConfig['zero']}` }
      }
    }

    if (count === 1) {
      if (existingIdentifierPlurals[pluralConfig['one']!]) {
        return `${identifier}_${pluralConfig['one']}`
      }
      return getFallback(`${identifier}_${pluralConfig['one']}`)
    }

    if (count === 2) {
      if (existingIdentifierPlurals[pluralConfig['two']!]) {
        return `${identifier}_${pluralConfig['two']}`
      }
      return getFallback(`${identifier}_${pluralConfig['two']}`)
    }

    if (count === 3) {
      if (existingIdentifierPlurals[pluralConfig['three']!]) {
        return `${identifier}_${pluralConfig['three']}`
      }
      return getFallback(`${identifier}_${pluralConfig['three']}`)
    }

    if (count > 3 && count < 11) {
      if (existingIdentifierPlurals[pluralConfig['few']!]) {
        return `${identifier}_${pluralConfig['few']}`
      }
      return getFallback(`${identifier}_${pluralConfig['few']}`)
    }

    if (count >= 11 && count < 100) {
      if (existingIdentifierPlurals[pluralConfig['many']!]) {
        return `${identifier}_${pluralConfig['many']}`
      }
      return getFallback(`${identifier}_${pluralConfig['many']}`)
    }

    return getFallback(expectedFallbackIdentifier)
  }

  /**
   * Formats a message using the messages formatter
   */
  public formatMessage(
    identifier: string,
    data?: Record<string, any> & { context?: string; count?: number; returnObject?: boolean },
    fallbackMessage?: string
  ): string {
    this.lazyLoadTranslations()
    let resolvedIdentifier = identifier
    let expectedFallbackIdentifier = ''

    const fallback = (missingKey: string) => {
      return (
        fallbackMessage ||
        `translation missing: ${this.locale}, ${missingKey}${
          expectedFallbackIdentifier
            ? `. expected fallback identifier: ${expectedFallbackIdentifier}`
            : ''
        }`
      )
    }

    if (data) {
      if ('context' in data) {
        resolvedIdentifier = this.resolveContextIdentifier(resolvedIdentifier, data?.context)
      }

      if ('count' in data) {
        const resolvedCountIdentifier = this.resolvePluralIdentifier(
          resolvedIdentifier,
          data?.count
        )

        if (typeof resolvedCountIdentifier === 'string') {
          resolvedIdentifier = resolvedCountIdentifier
        } else {
          resolvedIdentifier = resolvedCountIdentifier.missingKey
          expectedFallbackIdentifier = resolvedCountIdentifier.expectedFallbackIdentifier || ''
        }
      }
    }

    const message = this.getMessage(resolvedIdentifier, data?.returnObject ?? false)

    /**
     * Notify about the message translation
     */
    if (!message || message.isFallback) {
      this.notifyForMissingTranslation(resolvedIdentifier, message?.isFallback || false)
    }

    /**
     * Return identifier when message is missing, and config is set to return key as fallback
     */
    if (this.i18nManager.config?.fallback && !message) {
      return this.i18nManager.config.fallback(resolvedIdentifier, this.locale)
    }

    /**
     * Return translation missing string when there is no fallback
     * as well
     */
    if (!message) {
      return fallback(resolvedIdentifier)
    }

    return this.formatRawMessage(message.message, data)
  }

  /**
   * Shorthand method for formatMessage
   * @alias formatMessage
   */
  public t(
    identifier: string,
    data?: Record<string, any> & { context?: string; count?: number; returnObject?: boolean },
    fallbackMessage?: string
  ): string {
    return this.formatMessage(identifier, data, fallbackMessage)
  }

  #translateNestedObject(
    obj: Record<string, any>,
    formatter: TranslationsFormatterContract,
    locale: string,
    data: any
  ): Record<string, any> {
    const result: Record<string, any> = {}

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key]

        if (Array.isArray(value)) {
          // Process arrays by mapping over elements
          result[key] = value.map((item: any) => {
            if (Array.isArray(item)) {
              // Recursively process nested arrays
              return item.map((nestedItem: any) =>
                typeof nestedItem === 'string'
                  ? formatter.format(nestedItem, locale, data)
                  : typeof nestedItem === 'object' && nestedItem !== null
                  ? this.#translateNestedObject(nestedItem, formatter, locale, data)
                  : nestedItem
              )
            } else if (typeof item === 'string') {
              // Apply formatter to string elements
              return formatter.format(item, locale, data)
            } else if (typeof item === 'object' && item !== null) {
              // Recursively process object elements
              return this.#translateNestedObject(item, formatter, locale, data)
            } else {
              // Copy non-string, non-object, non-array elements as-is
              return item
            }
          })
        } else if (typeof value === 'object' && value !== null) {
          // Recursively process nested objects
          result[key] = this.#translateNestedObject(value, formatter, locale, data)
        } else if (typeof value === 'string') {
          // Apply formatter to string values
          result[key] = formatter.format(value, locale, data)
        } else {
          // Copy non-string, non-object, non-array values as-is
          result[key] = value
        }
      }
    }

    return result
  }

  /**
   * Formats a message using the messages formatter
   */
  public formatRawMessage(
    message: string | Record<string, string>,
    data?: Record<string, any>
  ): string {
    const formatter = this.i18nManager.getFormatter()

    if (typeof message === 'string') {
      return formatter.format(message, this.locale, data)
    }

    // Format all messages in the object
    const translatedObj = this.#translateNestedObject(message, formatter, this.locale, data)
    return JSON.stringify(translatedObj)
  }
}
