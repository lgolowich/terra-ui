import { Fragment } from 'react'
import { commonPaths } from 'src/components/breadcrumbs'
import DataExplorer from 'src/components/DataExplorer'
import { div, h } from 'react-hyperscript-helpers'
import TopBar from 'src/components/TopBar'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'

const DataExplorerPage = props => h(Fragment, [
  h(TopBar, { title: 'Library', href: Nav.getLink('library-datasets') }, [
    div({ style: Style.breadcrumb.breadcrumb }, [
      div({}, commonPaths.datasetList()),
      div({ style: Style.breadcrumb.textUnderBreadcrumb }, [
        'Data Explorer - ' + props.dataset
      ])
    ])
  ]),
  h(DataExplorer, { dataset: props.dataset })
])

export const navPaths = [
  {
    name: 'library-datasets-data-explorer',
    path: '/library/datasets/:dataset/data-explorer',
    component: DataExplorerPage,
    public: true,
    title: ({ dataset }) => `${dataset} - Data Explorer`
  }
]
