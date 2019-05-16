import { Component } from 'react'
import ErrorView from 'src/components/ErrorView'
import { h } from 'react-hyperscript-helpers'
import IframeResizer from 'react-iframe-resizer-super'
import * as Nav from 'src/libs/nav'


export const datasetOrigins = {
  // Key must be dataset name from Data Explorer dataset.json
  '1000 Genomes': 'https://test-data-explorer.appspot.com'
}


// Nav.history.location.search must have an origin param that is set to Data
// Explorer origin. (We use param instead of props/state so that users can
// copy-paste their url.)
export default class DataExplorer extends Component {
  render() {
    const { dataset } = this.props

    const params = new URLSearchParams(Nav.history.location.search)
    let origin = params.get('origin')
    params.delete('origin')

    return h(IframeResizer, {
      src: origin + '/?embed&' + params.toString(),
      iframeResizerOptions: {
        onMessage: ({ iframe, message }) => {
          if (message.importDataQueryStr) {
            Nav.history.push({
              pathname: Nav.getPath('import-data'),
              search: '?' + message.importDataQueryStr
            })
          } else if (message.deQueryStr) {
            // Propagate Data Explorer URL params to app.terra.bio.
            // Don't call Nav.history.replace(). That will trigger a request and
            // cause the page to flicker.
            const url = window.location.origin + '#' + Nav.history.location.pathname.slice(1) + '?' + message.deQueryStr + '&origin=' + origin
            window.history.replaceState({}, 'Data Explorer - ' + dataset, url)
          }
        }
      }
    })
  }
}
