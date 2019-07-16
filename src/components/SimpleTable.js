import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h, table, tbody, td, tr } from 'react-hyperscript-helpers'


export const SimpleTable = ({ title, data, rowHeight, columns = [] }) => {
  return h(Fragment, [
    title && div({ style: { fontWeight: 600 } }, title),
    dataTable({ data, columns, rowHeight })
  ])
}

const dataTable = ({ data, columns, rowHeight }) => {
  return table({ style: { width: '100%' } }, [
    tbody(_.map(dataRow => row({ dataRow, columns, rowHeight }), data))
  ])
}

const row = ({ dataRow, columns, rowHeight }) => {
  return tr({ style: { height: rowHeight } }, _.flow(
    _.zip(dataRow),
    _.map(item => td({
      style: item[1] && item[1].style
    }, item[0]))
  )(columns))
}
