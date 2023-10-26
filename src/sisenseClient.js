const _ = require('lodash')
const axios = require('axios')
const core = require('@actions/core')

class SisenseClient {
  constructor(
    token,
    url,
    projectId,
    branch,
    additionalDashboardsToPublish,
    designerToken
  ) {
    this.token = token
    this.url = url
    this.projectId = projectId
    this.branch = branch
    this.additionalDashboardsToPublish = additionalDashboardsToPublish
    this.designerToken = designerToken
  }

  async _makeAPIRequest(
    version = null,
    path,
    method = 'GET',
    body,
    additionalHeaders,
    useDesignerToken = false
  ) {
    const defaultHeaders = {
      Authorization: `Bearer ${
        useDesignerToken ? this.designerToken : this.token
      }`,
      'Content-Type': 'application/json'
    }

    const apiPath = version ? `api/${version}/${path}` : `api/${path}`
    const url = `${this.url}${apiPath}`

    core.debug(
      `Making request to url ${url} with method ${method} and body ${body}`
    )

    const res = await axios({
      headers: {
        ...defaultHeaders,
        ...additionalHeaders
      },
      method,
      url,
      data: body
    })

    return res.data
  }

  async _makeProjectRequest(path, method = 'GET', additionalHeaders, body) {
    const apiV2ProjectsPath = `projects/${this.projectId}/`

    core.debug('getting latest checksum')
    const checkSumRes = await this._makeAPIRequest(
      'v2',
      `${apiV2ProjectsPath}status`
    )

    const checksum = checkSumRes.statusChecksum

    core.debug(`latest checksum ${checksum}`)

    const headers = {
      ...additionalHeaders,
      'x-git-status-checksum': checksum
    }

    const res = await this._makeAPIRequest(
      'v2',
      `${apiV2ProjectsPath}${path}`,
      method,
      body,
      headers
    )

    core.debug(`response: ${res}`)

    return res
  }

  async discardUncommitedChanges() {
    const headDiff = await this._makeProjectRequest('diff/HEAD/working')
    const arrayOffChanges = _.keys(headDiff.fileDiffs)

    core.debug(`array of changes ${arrayOffChanges}`)

    if (_.size(arrayOffChanges) > 0) {
      const res = await this._makeProjectRequest(
        'discard',
        'POST',
        {},
        {
          changes: arrayOffChanges
        }
      )
    }
  }

  async getDashboardsNeedsRepublishing() {
    try {
      const mainDiff = await this._makeProjectRequest(`diff/${this.branch}`)
      const arrayOffChanges = _.keys(mainDiff.fileDiffs)
      // example of changed dashboard path dashboards/6538ffb9a034de00333a6ef0/dashboard.json
      // when we split dashboard position is with index 1
      const positionOfDashboardId = 1
      const affectedDashboards = _(arrayOffChanges)
        .filter(ac => ac.startsWith('dashboards/'))
        .map(ac => {
          const pathElems = ac.split('/')

          return pathElems[positionOfDashboardId]
        })
        .uniq()
        .value()

      return affectedDashboards
    } catch (error) {
      core.error(error)
      return []
    }
  }

  async pullLatestToMaster() {
    const affectedDashboardIds = await this.getDashboardsNeedsRepublishing()
    core.debug(`Affected dashboards ${affectedDashboardIds}`)

    await this._makeProjectRequest(
      'pull',
      'POST',
      {},
      {
        remoteBranch: this.branch
      }
    )

    await this._makeProjectRequest('sync', 'POST', {}, {})

    core.debug('Publishing')
    await this.publishAffectedDashboards(affectedDashboardIds)
  }

  async publishAffectedDashboards(affectedDashboardIds) {
    const dashboardsToPublish = [
      ...affectedDashboardIds,
      ...this.additionalDashboardsToPublish
    ]
    const useDesignerToken = true

    for await (const dashboardId of dashboardsToPublish) {
      try {
        core.debug(`publishing dashboard with id ${dashboardId}`)
        core.debug('getting dashboard data')
        const dashboardShareData = await this._makeAPIRequest(
          null,
          `shares/dashboard/${dashboardId}`,
          'GET',
          {},
          {},
          true
        )

        core.debug('posting dashboard changes')
        await this._makeAPIRequest(
          null,
          `shares/dashboard/${dashboardId}`,
          'POST',
          dashboardShareData,
          {},
          useDesignerToken
        )
      } catch (error) {
        core.error(error)
      }
    }
  }
}

module.exports = { SisenseClient }
