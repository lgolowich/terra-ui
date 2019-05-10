import * as breadcrumbs from 'src/components/breadcrumbs'
import DataExplorer from 'src/components/DataExplorer'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const DataExplorerPage = wrapWorkspace({
  breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
  showTabBar: false,
  title: props => 'Data Explorer - ' + props.dataset
})(DataExplorer)

export const navPaths = [
  {
    name: 'workspace-data-explorer',
    path: '/workspaces/:namespace/:name/:dataset/data-explorer',
    component: DataExplorerPage,
    title: ({ dataset }) => `${dataset} - Data Explorer`
  }
]
