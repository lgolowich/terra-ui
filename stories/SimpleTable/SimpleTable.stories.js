import 'src/style.css'

import { object, withKnobs } from '@storybook/addon-knobs/react'
import { storiesOf } from '@storybook/react'
import { SimpleTable } from 'components/SimpleTable'
import { div, h } from 'react-hyperscript-helpers'

// import { mockSelectedEntities as selectedEntities } from './MockSelectedEntities'

const border = '1px solid black'

storiesOf('SimpleTable', module)
  .addDecorator(withKnobs)
  .add('With all options', () => {
    return h(TableWithHeadings, {
      title: object('title', 'Test Title'),
      data: object('data', [[1, 2], [3, 7]]),
      rowHeight: object('rowHeight', '2.5rem'),
      columns: object('columns', [{ style: { width: '60%', border } }, { style: { width: '40%', border } }])
    })
  })
  .add('With multiple rows', () => h(TableWithMultipleRows))
  .add('With one row', () => h(TableWithOneRow))

const TableWithOneRow = () => {
  return div({ style: { width: '400px' } }, [
    h(SimpleTable, {
      data: [[1, 2]]
    })
  ])
}

const TableWithMultipleRows = () => {
  return div({ style: { width: '400px' } }, [
    h(SimpleTable, {
      data: [[1, 2], [3, 4], [5]],
      columns: object('columns', [{ style: { width: '60%', border } }, { style: { width: '40%', border } }])
    })
  ])
}

const TableWithHeadings = ({ title, data, rowHeight, columns }) => {
  return div({ style: { width: '400px' } }, [
    h(SimpleTable, { title, rowHeight, columns, data })
  ])
}
