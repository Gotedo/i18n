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
} from '@ioc:Adonis/Addons/I18n'
import { Formatter } from '../Formatters/Core'

/**
 * I18n class works with a dedicated locale at a given point
 * in time
 */
export class I18n extends Formatter implements I18nContract {
  /**
   * Locale translations
   */
  private localeTranslations: Record<string, string>

  /**
   * Fallback translations
   */
  private fallbackTranslations: Record<string, string>

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
    this.localeTranslations = this.i18nManager.getTranslationsFor(this.locale)
    this.fallbackTranslations = this.i18nManager.getTranslationsFor(this.fallbackLocale)
  }

  /**
   * Lazy load translations. Doing this as i18n class usually results in switchLocale
   * during real world use cases
   */
  private lazyLoadTranslations() {
    if (!this.localeTranslations && !this.fallbackTranslations) {
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
  private getMessage(identifier: string): { message: string; isFallback: boolean } | null {
    let message = this.localeTranslations[identifier]

    /**
     * Return the translation (if exists)
     */
    if (message) {
      return { message, isFallback: false }
    }

    /**
     * Look for translation inside the fallback messages
     */
    message = this.fallbackTranslations[identifier]
    if (message) {
      return { message, isFallback: true }
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
    const message = this.getMessage(identifier)

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
    data?: Record<string, any> & { context?: string; count?: number },
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

    const message = this.getMessage(resolvedIdentifier)

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
   * Shorthand method for formatUsage
   * @alias formatUsage
   */
  public t(identifier: string, data?: Record<string, any>, fallbackMessage?: string): string {
    return this.formatMessage(identifier, data, fallbackMessage)
  }

  /**
   * Formats a message using the messages formatter
   */
  public formatRawMessage(message: string, data?: Record<string, any>): string {
    return this.i18nManager.getFormatter().format(message, this.locale, data)
  }
}
