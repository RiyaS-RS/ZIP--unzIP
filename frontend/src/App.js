import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Table, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

function App() {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const onDrop = React.useCallback((acceptedFiles) => {
        setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: '.zip',
        multiple: false
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage('Please select a file');
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {

            const response = await axios.post('http://localhost:3002/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            const { files } = response.data;
            setMessage('File uploaded successfully');
            setUploadedFiles(files);
            setFile(null);
        } catch (error) {
            handleError(error);
        }
    };

    const fetchUploadedFiles = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('http://localhost:3002/files');
            setUploadedFiles(response.data);
        } catch (error) {
            handleError(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleError = (error) => {
        if (error.response) {
            setMessage(`Error: ${error.response.data.error || 'Unknown error'}`);
        } else if (error.request) {
            setMessage('Error: No response from server. Please check if the server is running.');
        } else {
            setMessage(`Error: ${error.message}`);
        }
        console.error('Error:', error);
    };

    useEffect(() => {
        const resetAndFetchFiles = async () => {
            try {
                await axios.post('http://localhost:3002/reset-files');
                await new Promise(resolve => setTimeout(resolve, 2000));
                fetchUploadedFiles();
            } catch (error) {
                console.error('Error resetting files:', error);
            }
        };

        resetAndFetchFiles();

        
        return () => setUploadedFiles([]);
    }, []);

    return (
        <Container className="mt-5">
            <h1 className="text-center mb-4">File Upload System</h1>
            <Row>
                <Col md={6} className="mx-auto">
                    <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                        <input {...getInputProps()} />
                        <p>Drag 'n' drop a zip file here, or click to select a file</p>
                    </div>
                    {file && (
                        <div className="mt-3">
                            <p>Selected file: {file.name}</p>
                            <Button variant="primary" onClick={handleSubmit}>
                                Upload
                            </Button>
                        </div>
                    )}
                    {message && <Alert variant="info" className="mt-3">{message}</Alert>}
                </Col>
            </Row>
            <Row className="mt-5">
                <Col>
                    <h2>Uploaded Files</h2>
                    {isLoading ? (
                        <p>Loading files...</p>
                    ) : uploadedFiles.length > 0 ? (
                        <Table striped bordered hover>
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>File Name</th>
                                    <th>File Size</th>
                                    <th>Created Date</th>
                                    <th>File Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uploadedFiles.map((file, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>{file.name}</td>
                                        <td>{file.size} bytes</td>
                                        <td>{file.created}</td>
                                        <td>{file.type}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <p>No files uploaded yet.</p>
                    )}
                </Col>
            </Row>
        </Container>
    );
}

export default App;