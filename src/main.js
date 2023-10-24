const core = require('@actions/core')
const { SisenseClient } = require('./sisenseClient')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const token = core.getInput('token')
    const sisenseHost = core.getInput('sisenseHost')
    const projectId = core.getInput('projectId')
    const branch = core.getInput('branch')

    const sisenseClient = new SisenseClient(
      token,
      sisenseHost,
      projectId,
      branch
    )
    core.debug('Discarding un commited cahnges')
    await sisenseClient.discardUncommitedChanges()

    core.debug('Starting pulling latest from branch')
    await sisenseClient.pullLatestToMaster()
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
