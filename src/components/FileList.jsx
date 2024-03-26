import { ArrowDownward, InsertDriveFile } from "@mui/icons-material";
import {
  Button,
  Checkbox,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from "@mui/material";
import { useSnackbar } from "notistack";
import styled from "styled-components";
import prettyBytes from "pretty-bytes";
import { ListObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { useEffect, useState, useRef } from "react";
import { fileUpload, generatePresignUrl } from "../services/model";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

function FileList({ className, prefix, id, onSelect }) {
  const { enqueueSnackbar } = useSnackbar();
  const wallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [downloadLinks, setLinks] = useState([]);
  const fileInputRef = useRef(null);

  const S3client = new S3Client({
    region: "ap-northeast-2",
    signer: { sign: async (request) => request },
  });
  const handleUpload = async (file) => {
    try {
      const path = await generatePresignUrl(
        parseInt(id),
        file.name,
        wallet.publicKey.toString()
      );
      await fileUpload(path, file);
    } catch (e) {
      console.log(e);
    }
  };
  const handleFileInputChange = async (event) => {
    try {
      const file = event.target.files[0];
      await handleUpload(file);
      loadFileList();
      enqueueSnackbar("Upload Success", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(e, { variant: "error" });
    }
  };
  const loadFileList = () => {
    setLoading(true);
    const command = new ListObjectsCommand({
      Bucket: "distriai",
      Prefix: prefix,
    });
    S3client.send(command)
      .then(({ Contents }) => setFiles(Contents || []))
      .then(() => setLoading(false));
  };
  const handleSelection = (e, key) => {
    if (e.target.checked) {
      setLinks([
        ...downloadLinks,
        `https://distriai.s3.ap-northeast-2.amazonaws.com/${key}`,
      ]);
    } else {
      setLinks(
        downloadLinks.filter(
          (link) =>
            link !== `https://distriai.s3.ap-northeast-2.amazonaws.com/${key}`
        )
      );
    }
  };
  useEffect(() => {
    if (onSelect) {
      onSelect(downloadLinks);
    }
  }, [onSelect, downloadLinks]);
  useEffect(() => {
    loadFileList();
  }, [prefix]);
  return (
    <div className={className}>
      <Stack direction="column">
        {!onSelect && (
          <Stack direction="row" justifyContent="end" spacing={2}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
            <Button
              variant="contained"
              className="cbtn"
              style={{ width: 100, margin: "0 20px" }}
              onClick={() => {
                fileInputRef.current.click();
              }}>
              Add File
            </Button>
          </Stack>
        )}
        {loading ? (
          <CircularProgress />
        ) : files.length > 0 ? (
          <TableContainer>
            <Table>
              <TableBody>
                {files.map(
                  (file) =>
                    file.Key !== prefix && (
                      <TableRow key={file.Key}>
                        {onSelect && (
                          <TableCell width="5%">
                            <Checkbox
                              checked={downloadLinks.includes(
                                `https://distriai.s3.ap-northeast-2.amazonaws.com/${file.Key}`
                              )}
                              onChange={(e) => handleSelection(e, file.Key)}
                            />
                          </TableCell>
                        )}
                        <TableCell width="20%">
                          <InsertDriveFile />
                          {file.Key.replace(prefix, "")}
                        </TableCell>
                        <TableCell align="right">
                          <ArrowDownward />
                          <a
                            style={{
                              display: "inline",
                            }}
                            href={`https://distriai.s3.ap-northeast-2.amazonaws.com/${file.Key}`}
                            download>
                            <span className="size">
                              {prettyBytes(file.Size)}
                            </span>
                          </a>
                        </TableCell>
                        <TableCell align="right">
                          <span className="date">
                            {new Date(file.LastModified).toLocaleDateString()}
                          </span>
                          <span className="time">
                            {new Date(file.LastModified).toLocaleTimeString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <div className="empty">
            <span>No file uploaded yet</span>
          </div>
        )}
      </Stack>
    </div>
  );
}
export default styled(FileList)`
  width: 100%;
  a {
    color: white;
    display: block;
    height: 100%;
  }
  .date,
  .time {
    display: block;
  }
  .time {
    color: #aaa;
  }
  .size {
    display: inline-block;
    width: 64px;
    text-align: right;
  }
  .empty {
    width: 100%;
    height: 480px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;