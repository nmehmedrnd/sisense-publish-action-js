const _ = require('lodash')
const axios = require('axios')
const core = require('@actions/core')

class SisenseClient {
  constructor(token, url, projectId, branch) {
    this.token = token
    this.url = url
    this.projectId = projectId
    this.branch = branch
  }

  async _makeRequest(path, method = 'GET', additionalHeaders, body) {
    const apiV2ProjectsPath = `api/v2/projects/${this.projectId}/`
    const authHeaders = {
      Authorization: `Bearer ${this.token}`
    }

    core.debug('getting latest checksum')
    const resCheckSum = await axios({
      url: `${this.url}${apiV2ProjectsPath}status`,
      headers: authHeaders
    })

    const checksum = resCheckSum.data.statusChecksum

    core.debug(`latest checksum ${checksum}`)

    const headers = {
      ...additionalHeaders,
      ...authHeaders,
      'x-git-status-checksum': checksum,
      'Content-Type': 'application/json'
    }

    const url = `${this.url}${apiV2ProjectsPath}${path}`

    core.debug(
      `Making request to url ${url} with method ${method} and body ${body}`
    )

    const res = await axios({
      headers,
      method,
      url,
      data: body
    })

    core.debug(`response: ${res}`)

    return res.data
  }

  async discardUncommitedChanges() {
    const headDiff = await this._makeRequest('diff/HEAD/working')
    const arrayOffChanges = _.keys(headDiff.fileDiffs)

    core.debug(`array of changes ${arrayOffChanges}`)

    if (_.size(arrayOffChanges) > 0) {
      const res = await this._makeRequest(
        'discard',
        'POST',
        {},
        {
          changes: arrayOffChanges
        }
      )
    }
  }

  async pullLatestToMaster() {
    await this._makeRequest(
      'pull',
      'POST',
      {},
      {
        remoteBranch: this.branch
      }
    )
  }
}

module.exports = { SisenseClient }
