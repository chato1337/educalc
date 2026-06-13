import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import GridOnIcon from '@mui/icons-material/GridOn'
import TableChartIcon from '@mui/icons-material/TableChart'
import {
  Box,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  Stack,
  Tooltip,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type RichTextEditorProps = {
  label?: string
  value?: string
  onChange: (html: string) => void
  error?: boolean
  helperText?: string
  minHeight?: number
  disabled?: boolean
}

const EditorRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'error' && prop !== 'disabled',
})<{ error?: boolean; disabled?: boolean }>(({ theme, error, disabled }) => ({
  border: `1px solid ${
    error
      ? theme.palette.error.main
      : theme.palette.mode === 'light'
        ? 'rgba(0, 0, 0, 0.23)'
        : 'rgba(255, 255, 255, 0.23)'
  }`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: disabled ? theme.palette.action.disabledBackground : 'transparent',
  opacity: disabled ? 0.7 : 1,
  transition: theme.transitions.create(['border-color', 'box-shadow']),
  ...(!disabled && {
    '&:hover': {
      borderColor: error ? theme.palette.error.main : theme.palette.text.primary,
    },
    '&:focus-within': {
      borderColor: error ? theme.palette.error.main : theme.palette.primary.main,
      boxShadow: `0 0 0 1px ${error ? theme.palette.error.main : theme.palette.primary.main}`,
    },
  }),
}))

const Toolbar = styled(Stack)(({ theme }) => ({
  flexWrap: 'wrap',
  gap: theme.spacing(0.25),
  padding: theme.spacing(0.75, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
}))

const EditorBody = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'minHeight' && prop !== 'disabled',
})<{ minHeight: number; disabled?: boolean }>(({ theme, minHeight, disabled }) => {
  const contentMinHeight = `calc(${minHeight}px - 2 * ${theme.spacing(1.5)})`

  return {
    minHeight,
    padding: theme.spacing(1.5),
    boxSizing: 'border-box',
    resize: disabled ? 'none' : 'vertical',
    overflow: 'auto',
    '& > div': {
      minHeight: contentMinHeight,
      height: '100%',
    },
    '& .tiptap': {
      outline: 'none',
      minHeight: contentMinHeight,
      height: '100%',
      '& p': {
        margin: 0,
        marginBottom: theme.spacing(1),
      },
      '& p:last-child': {
        marginBottom: 0,
      },
      '& ul, & ol': {
        margin: theme.spacing(0, 0, 1, 0),
        paddingLeft: theme.spacing(3),
      },
      '& table': {
        borderCollapse: 'collapse',
        width: '100%',
        marginBottom: theme.spacing(1),
        tableLayout: 'fixed',
      },
      '& th, & td': {
        border: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(0.75, 1),
        verticalAlign: 'top',
        minWidth: 48,
      },
      '& th': {
        backgroundColor: theme.palette.action.hover,
        fontWeight: 600,
      },
      '& .selectedCell::after': {
        background: theme.palette.action.selected,
        content: '""',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        pointerEvents: 'none',
        position: 'absolute',
        zIndex: 2,
      },
    },
  }
})

function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          color={active ? 'primary' : 'default'}
          disabled={disabled}
          onClick={onClick}
          aria-label={title}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

function EditorToolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const { t } = useTranslation()
  const inTable = editor.isActive('table')

  return (
    <Toolbar direction="row" alignItems="center">
      <ToolbarButton
        title={t('richTextEditor.bold')}
        active={editor.isActive('bold')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <FormatBoldIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        title={t('richTextEditor.italic')}
        active={editor.isActive('italic')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <FormatItalicIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        title={t('richTextEditor.underline')}
        active={editor.isActive('underline')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <FormatUnderlinedIcon fontSize="small" />
      </ToolbarButton>
      <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
      <ToolbarButton
        title={t('richTextEditor.bulletList')}
        active={editor.isActive('bulletList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <FormatListBulletedIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        title={t('richTextEditor.orderedList')}
        active={editor.isActive('orderedList')}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <FormatListNumberedIcon fontSize="small" />
      </ToolbarButton>
      <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
      <ToolbarButton
        title={t('richTextEditor.alignLeft')}
        active={editor.isActive({ textAlign: 'left' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <FormatAlignLeftIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        title={t('richTextEditor.alignCenter')}
        active={editor.isActive({ textAlign: 'center' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <FormatAlignCenterIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        title={t('richTextEditor.alignRight')}
        active={editor.isActive({ textAlign: 'right' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <FormatAlignRightIcon fontSize="small" />
      </ToolbarButton>
      <ToolbarButton
        title={t('richTextEditor.alignJustify')}
        active={editor.isActive({ textAlign: 'justify' })}
        disabled={disabled}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
      >
        <FormatAlignJustifyIcon fontSize="small" />
      </ToolbarButton>
      <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
      <ToolbarButton
        title={t('richTextEditor.insertTable')}
        disabled={disabled}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        <TableChartIcon fontSize="small" />
      </ToolbarButton>
      {inTable ? (
        <>
          <ToolbarButton
            title={t('richTextEditor.addRowAfter')}
            disabled={disabled}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <GridOnIcon fontSize="small" />
          </ToolbarButton>
          <ToolbarButton
            title={t('richTextEditor.addColumnAfter')}
            disabled={disabled}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Box component="span" sx={{ display: 'inline-flex', transform: 'rotate(90deg)' }}>
              <GridOnIcon fontSize="small" />
            </Box>
          </ToolbarButton>
          <ToolbarButton
            title={t('richTextEditor.deleteTable')}
            disabled={disabled}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <TableChartIcon fontSize="small" color="error" />
          </ToolbarButton>
        </>
      ) : null}
    </Toolbar>
  )
}

export function RichTextEditor({
  label,
  value = '',
  onChange,
  error,
  helperText,
  minHeight = 120,
  disabled = false,
}: RichTextEditorProps) {
  const labelId = label ? 'rich-text-editor-label' : undefined

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <FormControl fullWidth error={error} disabled={disabled}>
      {label ? (
        <InputLabel shrink htmlFor={labelId} sx={{ position: 'static', mb: 0.5, transform: 'none' }}>
          {label}
        </InputLabel>
      ) : null}
      <EditorRoot error={error} disabled={disabled}>
        {editor ? <EditorToolbar editor={editor} disabled={disabled} /> : null}
        <EditorBody minHeight={minHeight} disabled={disabled}>
          <EditorContent editor={editor} id={labelId} />
        </EditorBody>
      </EditorRoot>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  )
}
