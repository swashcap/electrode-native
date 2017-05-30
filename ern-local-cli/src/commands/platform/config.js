// @flow

import {
  config as ernConfig
} from '@walmart/ern-util'

exports.command = 'config <key> [value]'
exports.desc = 'Get or set a configuration key'

exports.builder = function (yargs: any) {
  return yargs
        .option('value', {
          alias: 'v',
          describe: 'Value to set for the key'
        })
}

exports.handler = function (argv: any) {
  if (argv.value) {
    ernConfig.setValue(argv.key, argv.value)
  } else {
    log.info(`${argv.key}: ${ernConfig.getValue(argv.key)}`)
  }
}
