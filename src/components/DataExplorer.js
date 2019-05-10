import { Component } from 'react'
import { h } from 'react-hyperscript-helpers'
import IframeResizer from 'react-iframe-resizer-super'
import * as Nav from 'src/libs/nav'


const datasetToUrl = {
  // key must be dataset name from Data Explorer dataset.json
  '1000 Genomes': 'https://test-data-explorer.appspot.com/?embed'
}


export default class DataExplorer extends Component {
  render() {
    const { dataset } = this.props

    return h(IframeResizer, {
      src: datasetToUrl[dataset] + '&' + Nav.history.location.search.slice(1),
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
            const url = window.location.origin + '#' + Nav.history.location.pathname.slice(1) + '?' + message.deQueryStr
            window.history.replaceState({}, 'Data Explorer - ' + dataset, url)
          }
        }
      }
    })
  }
}
