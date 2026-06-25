import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Tooltip,
  type DialogContentProps,
  type DialogProps,
} from '@mui/material'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

type FormDialogContextValue = {
  isFullscreen: boolean
}

const FormDialogContext = createContext<FormDialogContextValue>({
  isFullscreen: false,
})

export function useFormDialogLayout() {
  return useContext(FormDialogContext)
}

export type FormDialogProps = Omit<DialogProps, 'fullScreen' | 'title'> & {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  allowFullscreen?: boolean
}

export function FormDialog({
  open,
  onClose,
  title,
  children,
  allowFullscreen = true,
  maxWidth = 'sm',
  fullWidth = true,
  PaperProps: paperProps,
  ...dialogProps
}: FormDialogProps) {
  const { t } = useTranslation()
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!open) setIsFullscreen(false)
  }, [open])

  return (
    <FormDialogContext.Provider value={{ isFullscreen }}>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={isFullscreen}
        maxWidth={maxWidth}
        fullWidth={fullWidth}
        PaperProps={{
          ...paperProps,
          sx: [
            isFullscreen
              ? {
                  display: 'flex',
                  flexDirection: 'column',
                }
              : null,
            ...(Array.isArray(paperProps?.sx)
              ? paperProps.sx
              : paperProps?.sx
                ? [paperProps.sx]
                : []),
          ],
        }}
        {...dialogProps}
      >
        <Stack
          component="div"
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 3,
            py: 2,
            borderBottom: (theme) =>
              isFullscreen ? `1px solid ${theme.palette.divider}` : undefined,
          }}
        >
          <Box
            component="h2"
            sx={{
              flex: 1,
              minWidth: 0,
              m: 0,
              typography: 'h6',
            }}
          >
            {title}
          </Box>
          {allowFullscreen ? (
            <Tooltip
              title={
                isFullscreen
                  ? t('formDialog.exitFullscreen')
                  : t('formDialog.enterFullscreen')
              }
            >
              <IconButton
                aria-label={
                  isFullscreen
                    ? t('formDialog.exitFullscreen')
                    : t('formDialog.enterFullscreen')
                }
                onClick={() => setIsFullscreen((current) => !current)}
                edge="end"
                size="small"
              >
                {isFullscreen ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
        <Box
          sx={
            isFullscreen
              ? {
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                  '& > form': {
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                  },
                }
              : undefined
          }
        >
          {children}
        </Box>
      </Dialog>
    </FormDialogContext.Provider>
  )
}

export function getFormDialogContentSx(isFullscreen: boolean) {
  return isFullscreen
    ? {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }
    : undefined
}

export function FormDialogContent({
  children,
  sx,
  ...props
}: DialogContentProps) {
  const { isFullscreen } = useFormDialogLayout()

  return (
    <DialogContent
      sx={[getFormDialogContentSx(isFullscreen), ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...props}
    >
      {children}
    </DialogContent>
  )
}
