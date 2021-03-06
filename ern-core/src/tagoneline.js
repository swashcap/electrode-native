// @flow

// tagged template outputing a one line string
// used to help logging
export default function tagOneLine (literals: any, ...substitutions: any) {
  let result = ''

  for (let i = 0; i < substitutions.length; i++) {
    result += literals[i].replace(/\n{1}\s+/, ' ')
    result += substitutions[i]
  }

  result += literals[literals.length - 1].replace(/\n{1}\s+/, ' ')

  return result
}
