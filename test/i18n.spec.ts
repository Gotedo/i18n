/*
 * @adonisjs/i18n
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join } from 'path'

import { I18n } from '../src/I18n'
import { setup, fs } from '../test-helpers'
import { I18nManager } from '../src/I18nManager'
import { validatorBindings } from '../src/Bindings/Validator'

test.group('I18n', (group) => {
  group.each.teardown(async () => fs.cleanup())

  test('format a message by its identifier', async ({ assert }) => {
    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    await fs.add(
      'resources/lang/en/messages.json',
      JSON.stringify({
        greeting: 'The price is {price, number, ::currency/INR}',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()

    const i18n = new I18n('en', emitter, logger, i18nManager)
    assert.equal(i18n.formatMessage('messages.greeting', { price: 100 }), 'The price is ₹100.00')
  })

  test('format a message by its identifier and context: {$self}')
    .with(['join', 'leave', 'Join', 'Leave'])
    .run(async ({ assert }, requestType) => {
      const app = await setup()
      const emitter = app.container.resolveBinding('Adonis/Core/Event')
      const logger = app.container.resolveBinding('Adonis/Core/Logger')

      await fs.add(
        'resources/lang/en/messages.json',
        JSON.stringify({
          request_approval_join: 'The request to join the church has been approved',
          request_approval_leave: 'The request to leave the church has been approved',
        })
      )

      const i18nManager = new I18nManager(app, emitter, logger, {
        defaultLocale: 'en',
        translationsFormat: 'icu',
        provideValidatorMessages: true,
        loaders: {
          fs: {
            enabled: true,
            location: join(fs.basePath, 'resources/lang'),
          },
        },
      })

      await i18nManager.loadTranslations()

      const i18n = new I18n('en', emitter, logger, i18nManager)
      assert.equal(
        i18n.formatMessage('messages.request_approval', { context: requestType }),
        requestType.toLocaleLowerCase() === 'join'
          ? 'The request to join the church has been approved'
          : 'The request to leave the church has been approved'
      )
    })

  test('format a message by its identifier and plurals: {$self}')
    .with([0, 1, 100])
    .run(async ({ assert }, count) => {
      const app = await setup()
      const emitter = app.container.resolveBinding('Adonis/Core/Event')
      const logger = app.container.resolveBinding('Adonis/Core/Logger')

      await fs.add(
        'resources/lang/en/messages.json',
        JSON.stringify({
          request_approval_zero: 'No request was approved',
          request_approval_one: 'One (1) request was approved',
          request_approval_other: '{count} requests were approved',
        })
      )

      const i18nManager = new I18nManager(app, emitter, logger, {
        defaultLocale: 'en',
        translationsFormat: 'icu',
        provideValidatorMessages: true,
        loaders: {
          fs: {
            enabled: true,
            location: join(fs.basePath, 'resources/lang'),
          },
        },
      })

      await i18nManager.loadTranslations()

      const i18n = new I18n('en', emitter, logger, i18nManager)
      assert.equal(
        i18n.formatMessage('messages.request_approval', { count }),
        count === 0
          ? 'No request was approved'
          : count === 1
          ? 'One (1) request was approved'
          : '100 requests were approved'
      )
    })

  test('format a message by its identifier and plurals: {$self}')
    .with([0, 1, 2, 3, 5, 20, 200])
    .run(async ({ assert }, count) => {
      const app = await setup()
      const emitter = app.container.resolveBinding('Adonis/Core/Event')
      const logger = app.container.resolveBinding('Adonis/Core/Logger')

      await fs.add(
        'resources/lang/en/messages.json',
        JSON.stringify({
          request_approval_zero: 'No request was approved',
          request_approval_one: 'One (1) request was approved',
          request_approval_two: 'Two (2) requests were approved',
          request_approval_three: 'Three (3) requests were approved',
          request_approval_few: 'Few requests were approved',
          request_approval_many: 'Many requests were approved',
          request_approval_other: '{count} requests were approved',
        })
      )

      const i18nManager = new I18nManager(app, emitter, logger, {
        defaultLocale: 'en',
        translationsFormat: 'icu',
        provideValidatorMessages: true,
        loaders: {
          fs: {
            enabled: true,
            location: join(fs.basePath, 'resources/lang'),
          },
        },
      })

      await i18nManager.loadTranslations()

      const i18n = new I18n('en', emitter, logger, i18nManager)
      assert.equal(
        i18n.formatMessage('messages.request_approval', { count }),
        count === 0
          ? 'No request was approved'
          : count === 1
          ? 'One (1) request was approved'
          : count === 2
          ? 'Two (2) requests were approved'
          : count === 3
          ? 'Three (3) requests were approved'
          : count === 5
          ? 'Few requests were approved'
          : count === 20
          ? 'Many requests were approved'
          : '200 requests were approved'
      )
    })

  test('should return translation when both context and count are provided')
    .with([0, 1, 2])
    .run(async ({ assert }, count) => {
      const app = await setup()
      const emitter = app.container.resolveBinding('Adonis/Core/Event')
      const logger = app.container.resolveBinding('Adonis/Core/Logger')

      await fs.add(
        'resources/lang/en/messages.json',
        JSON.stringify({
          read_time_minute_zero: '{count} minute',
          read_time_minute_one: '1 minute {count} second',
          read_time_minute_other: '1 minute {count} seconds',
        })
      )

      const i18nManager = new I18nManager(app, emitter, logger, {
        defaultLocale: 'en',
        translationsFormat: 'icu',
        provideValidatorMessages: true,
        loaders: {
          fs: {
            enabled: true,
            location: join(fs.basePath, 'resources/lang'),
          },
        },
      })

      await i18nManager.loadTranslations()

      const i18n = new I18n('en', emitter, logger, i18nManager)
      assert.equal(
        i18n.formatMessage('messages.read_time', { count, context: 'minute' }),
        count === 0 ? '0 minute' : count === 1 ? '1 minute 1 second' : '1 minute 2 seconds'
      )
    })

  test('format a message by its identifier and plurals with custom plural keys: {$self}')
    .with([0, 1, 2, 3, 5, 20, 200])
    .run(async ({ assert }, count) => {
      const app = await setup()
      const emitter = app.container.resolveBinding('Adonis/Core/Event')
      const logger = app.container.resolveBinding('Adonis/Core/Logger')

      await fs.add(
        'resources/lang/en/messages.json',
        JSON.stringify({
          request_approval_zéro: 'No request was approved',
          request_approval_un: 'One (1) request was approved',
          request_approval_deux: 'Two (2) requests were approved',
          request_approval_trois: 'Three (3) requests were approved',
          request_approval_peu: 'Few requests were approved',
          request_approval_beaucoup: 'Many requests were approved',
          request_approval_autre: '{count} requests were approved',
        })
      )

      const i18nManager = new I18nManager(app, emitter, logger, {
        defaultLocale: 'en',
        translationsFormat: 'icu',
        provideValidatorMessages: true,
        loaders: {
          fs: {
            enabled: true,
            location: join(fs.basePath, 'resources/lang'),
          },
        },
        plurals: {
          zero: 'zéro',
          one: 'un',
          two: 'deux',
          three: 'trois',
          few: 'peu',
          many: 'beaucoup',
          other: 'autre',
        },
      })

      await i18nManager.loadTranslations()

      const i18n = new I18n('en', emitter, logger, i18nManager)
      assert.equal(
        i18n.formatMessage('messages.request_approval', { count }),
        count === 0
          ? 'No request was approved'
          : count === 1
          ? 'One (1) request was approved'
          : count === 2
          ? 'Two (2) requests were approved'
          : count === 3
          ? 'Three (3) requests were approved'
          : count === 5
          ? 'Few requests were approved'
          : count === 20
          ? 'Many requests were approved'
          : '200 requests were approved'
      )

      // @ts-ignore
      i18nManager.config = {}
    })

  test(
    'format a message using the "other" plural identifier if expected count identifier is not provided: {$self}'
  )
    .with([0, 1, 2, 3, 10, 200])
    .run(async ({ assert }, count) => {
      const app = await setup()
      const emitter = app.container.resolveBinding('Adonis/Core/Event')
      const logger = app.container.resolveBinding('Adonis/Core/Logger')

      await fs.add(
        'resources/lang/en/messages.json',
        JSON.stringify({
          request_approval_zero: 'No request was approved',
          request_approval_other: 'Many requests were approved',
        })
      )

      const i18nManager = new I18nManager(app, emitter, logger, {
        defaultLocale: 'en',
        translationsFormat: 'icu',
        provideValidatorMessages: true,
        loaders: {
          fs: {
            enabled: true,
            location: join(fs.basePath, 'resources/lang'),
          },
        },
        plurals: {
          zero: 'zero',
          one: 'one',
          two: 'two',
          three: 'three',
          few: 'few',
          many: 'many',
          other: 'other',
        },
      })

      await i18nManager.loadTranslations()

      const i18n = new I18n('en', emitter, logger, i18nManager)
      assert.equal(
        i18n.formatMessage('messages.request_approval', { count }),
        count === 0 ? 'No request was approved' : 'Many requests were approved'
      )
    })

  test('should return translation error string if no count identifier is provided')
    .with([0, 1, 2, 3, 10, 50, 200])
    .run(async ({ assert }, count) => {
      const app = await setup()
      const emitter = app.container.resolveBinding('Adonis/Core/Event')
      const logger = app.container.resolveBinding('Adonis/Core/Logger')

      const i18nManager = new I18nManager(app, emitter, logger, {
        defaultLocale: 'en',
        translationsFormat: 'icu',
        provideValidatorMessages: true,
        loaders: {
          fs: {
            enabled: true,
            location: join(fs.basePath, 'resources/lang'),
          },
        },
      })

      await i18nManager.loadTranslations()

      const i18n = new I18n('en', emitter, logger, i18nManager)

      assert.equal(
        i18n.formatMessage('messages.request_approval', { count }),
        (function () {
          switch (count) {
            case 0:
              return 'translation missing: en, messages.request_approval_zero'
            case 1:
              return 'translation missing: en, messages.request_approval_one. expected fallback identifier: messages.request_approval_other'
            case 2:
              return 'translation missing: en, messages.request_approval_two. expected fallback identifier: messages.request_approval_other'
            case 3:
              return 'translation missing: en, messages.request_approval_three. expected fallback identifier: messages.request_approval_other'
            case 10:
              return 'translation missing: en, messages.request_approval_few. expected fallback identifier: messages.request_approval_other'
            case 50:
              return 'translation missing: en, messages.request_approval_many. expected fallback identifier: messages.request_approval_other'
            default:
              return 'translation missing: en, messages.request_approval_other. expected fallback identifier: messages.request_approval_other'
          }
        })()
      )
    })

  test('format a message by its identifier using short method i18n.t()', async ({ assert }) => {
    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    await fs.add(
      'resources/lang/en/messages.json',
      JSON.stringify({
        price: 'The price is {price, number, ::currency/INR}',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()

    const i18n = new I18n('en', emitter, logger, i18nManager)
    assert.equal(i18n.t('messages.price', { price: 100 }), 'The price is ₹100.00')
  })

  test('use fallback messages when actual message is missing', async ({ assert }) => {
    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    await fs.add(
      'resources/lang/en/messages.json',
      JSON.stringify({
        greeting: 'The price is {price, number, ::currency/USD}',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()

    const i18n = new I18n('fr', emitter, logger, i18nManager)
    assert.equal(i18n.formatMessage('messages.greeting', { price: 100 }), 'The price is 100,00 $US')
  })

  test('report missing translations via events', async ({ assert }, done) => {
    assert.plan(2)

    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    emitter.on('i18n:missing:translation', (payload) => {
      assert.deepEqual(payload, {
        locale: 'fr',
        identifier: 'messages.greeting',
        hasFallback: false,
      })
      done()
    })

    await fs.add(
      'resources/lang/it/messages.json',
      JSON.stringify({
        greeting: 'The price is {price, number, ::currency/USD}',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()

    const i18n = new I18n('fr', emitter, logger, i18nManager)
    assert.equal(
      i18n.formatMessage('messages.greeting', { price: 100 }),
      'translation missing: en-in, greeting'
    )
  }).waitForDone()

  test('use fallback locale defined inside the config', async ({ assert }) => {
    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    await fs.add(
      'resources/lang/en/messages.json',
      JSON.stringify({
        greeting: 'The price is {price, number, ::currency/USD}',
      })
    )

    await fs.add(
      'resources/lang/es/messages.json',
      JSON.stringify({
        greeting: 'El precio es {price, number, ::currency/USD}',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      fallbackLocales: {
        ca: 'es',
      },
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()

    const i18n = new I18n('ca', emitter, logger, i18nManager)
    assert.equal(i18n.formatMessage('messages.greeting', { price: 100 }), 'El precio es 100,00 USD')
  })

  test('switch locale and fallback locale during switchLocale call', async ({ assert }) => {
    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    await fs.add(
      'resources/lang/en/messages.json',
      JSON.stringify({
        greeting: 'The price is {price, number, ::currency/USD}',
      })
    )

    await fs.add(
      'resources/lang/es/messages.json',
      JSON.stringify({
        greeting: 'El precio es {price, number, ::currency/USD}',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      fallbackLocales: {
        ca: 'es',
      },
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    const i18n = new I18n('en', emitter, logger, i18nManager)
    assert.equal(i18n.locale, 'en')
    assert.equal(i18n.fallbackLocale, 'en')

    i18n.switchLocale('ca')
    assert.equal(i18n.locale, 'ca')
    assert.equal(i18n.fallbackLocale, 'es')
  })
})

test.group('I18n | validatorBindings', (group) => {
  group.each.teardown(async () => fs.cleanup())

  test('provide validation messages', async ({ assert }) => {
    assert.plan(1)

    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const { validator, schema } = app.container.resolveBinding('Adonis/Core/Validator')

    await fs.add(
      'resources/lang/en/validator.json',
      JSON.stringify({
        shared: {
          required: '{ field } is required',
        },
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    emitter.on('i18n:missing:translation', () => {
      throw new Error('Never expected to reach here')
    })

    await i18nManager.loadTranslations()
    validatorBindings(validator, i18nManager)

    try {
      await validator.validate({
        schema: schema.create({
          username: schema.string(),
        }),
        data: {},
      })
    } catch (error) {
      assert.deepEqual(error.messages, { username: ['username is required'] })
    }
  })

  test('give priority to field + rule messages', async ({ assert }) => {
    assert.plan(1)

    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const { validator, schema } = app.container.resolveBinding('Adonis/Core/Validator')

    await fs.add(
      'resources/lang/en/validator.json',
      JSON.stringify({
        shared: {
          'required': '{ field } is required',
          'username.required': 'username is required to signup',
        },
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    emitter.on('i18n:missing:translation', () => {
      throw new Error('Never expected to reach here')
    })

    await i18nManager.loadTranslations()
    validatorBindings(validator, i18nManager)

    try {
      await validator.validate({
        schema: schema.create({
          username: schema.string(),
        }),
        data: {},
      })
    } catch (error) {
      assert.deepEqual(error.messages, { username: ['username is required to signup'] })
    }
  })

  test('report missing validation translation for just the rule', async ({ assert }) => {
    assert.plan(2)

    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const { validator, schema } = app.container.resolveBinding('Adonis/Core/Validator')

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()
    validatorBindings(validator, i18nManager)

    emitter.on('i18n:missing:translation', (payload) => {
      assert.deepEqual(payload, {
        locale: 'en',
        identifier: 'validator.shared.required',
        hasFallback: false,
      })
    })

    try {
      await validator.validate({
        schema: schema.create({
          username: schema.string(),
        }),
        data: {},
      })
    } catch (error) {
      assert.deepEqual(error.messages, { username: ['required validation failed on username'] })
    }
  })

  test('report missing translation for the exact key that has a fallback', async ({ assert }) => {
    assert.plan(2)

    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const { validator, schema } = app.container.resolveBinding('Adonis/Core/Validator')

    await fs.add(
      'resources/lang/en/validator.json',
      JSON.stringify({
        shared: {
          'required': '{ field } is required',
          'username.required': 'username is required to signup',
        },
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()
    validator.messages(() => i18nManager.locale('it').validatorMessages())

    emitter.on('i18n:missing:translation', (payload) => {
      assert.deepEqual(payload, {
        locale: 'it',
        identifier: 'validator.shared.username.required',
        hasFallback: true,
      })
    })

    try {
      await validator.validate({
        schema: schema.create({
          username: schema.string(),
        }),
        data: {},
      })
    } catch (error) {
      assert.deepEqual(error.messages, { username: ['username is required to signup'] })
    }
  })

  test('find if a message exists', async ({ assert }) => {
    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    await fs.add(
      'resources/lang/en/messages.json',
      JSON.stringify({
        greeting: '',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()

    const i18n = new I18n('en', emitter, logger, i18nManager)
    assert.isTrue(i18n.hasMessage('messages.greeting'))
    assert.isFalse(i18n.hasMessage('messages.title'))
  })

  test('find if a fallback message exists', async ({ assert }) => {
    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    await fs.add(
      'resources/lang/en/messages.json',
      JSON.stringify({
        greeting: '',
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    await i18nManager.loadTranslations()

    const i18n = new I18n('fr', emitter, logger, i18nManager)
    assert.isFalse(i18n.hasMessage('messages.greeting'))
    assert.isTrue(i18n.hasFallbackMessage('messages.greeting'))
  })

  test('provide validation messages', async ({ assert }) => {
    assert.plan(1)

    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')
    const { validator, schema, rules } = app.container.resolveBinding('Adonis/Core/Validator')

    await fs.add(
      'resources/lang/en/validator.json',
      JSON.stringify({
        shared: {
          minLength: 'Field must be { minLength } chars long',
        },
      })
    )

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    emitter.on('i18n:missing:translation', () => {
      throw new Error('Never expected to reach here')
    })

    await i18nManager.loadTranslations()
    validatorBindings(validator, i18nManager)

    try {
      await validator.validate({
        schema: schema.create({
          username: schema.string({}, [rules.minLength(5)]),
        }),
        data: {
          username: 'a',
        },
      })
    } catch (error) {
      assert.deepEqual(error.messages, { username: ['Field must be 5 chars long'] })
    }
  })

  test('provide identifier as fallback if returnKeyAsFallback is set to true', async ({
    assert,
  }) => {
    assert.plan(1)

    const app = await setup()
    const emitter = app.container.resolveBinding('Adonis/Core/Event')
    const logger = app.container.resolveBinding('Adonis/Core/Logger')

    const i18nManager = new I18nManager(app, emitter, logger, {
      defaultLocale: 'en',
      translationsFormat: 'icu',
      provideValidatorMessages: true,
      fallback: (identifier, locale) => {
        return JSON.stringify({ identifier, locale })
      },
      loaders: {
        fs: {
          enabled: true,
          location: join(fs.basePath, 'resources/lang'),
        },
      },
    })

    const i18n = new I18n('en', emitter, logger, i18nManager)

    await i18nManager.loadTranslations()

    assert.deepEqual(
      i18n.formatMessage('missing.key'),
      JSON.stringify({ identifier: 'missing.key', locale: 'en' })
    )
  })
})
