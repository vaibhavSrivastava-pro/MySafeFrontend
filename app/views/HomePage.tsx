import PasswordPromptModal from '@/components/PasswrodPromptModal';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export interface PasswordPromptModalProps {
  isVisible: boolean;
  mode: 'decrypt' | 'encrypt';
  onSubmit: (key: string) => void;
  onCancel: () => void;
}

const HomePage: React.FC = () => {
  const [fileContent, setFileContent] = useState<string>('');
  const [isEdited, setIsEdited] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [currentFileUri, setCurrentFileUri] = useState<string | null>(null);
  
  // State for modal control
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  const [passwordModalMode, setPasswordModalMode] = useState<'decrypt' | 'encrypt'>('decrypt');
  const [pendingEncryptedContent, setPendingEncryptedContent] = useState<string | null>(null);
  const [pendingFileUri, setPendingFileUri] = useState<string | null>(null);

  const navigation = useNavigation<any>();

  // API-based encryption function
  const encryptContent = async (data: {content: string, metadata: string}, password: string): Promise<string> => {
    try {
      const response = await axios.post('http://192.168.217.124:3000/encrypt', {
        data: data.content,
        metadata: data.metadata,
        password: password
      });
      
      if (response.status !== 200 || !response.data.encryptedData) {
        throw new Error('Encryption failed');
      }
      
      return response.data.encryptedData;
    } catch (err) {
      console.error('Encryption failed:', err);
      throw new Error(`Encryption failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // API-based decryption function
  const decryptContent = async (encryptedData: string, password: string): Promise<string> => {
    try {
      const response = await axios.post('http://192.168.217.124:3000/decrypt', {
        encryptedData: encryptedData,
        password: password
      });
      
      if (response.status !== 200 || !response.data.decryptedData) {
        throw new Error('Decryption failed');
      }
      
      return response.data.decryptedData;
    } catch (err) {
      console.error('Decryption failed:', err);
      throw new Error(`Decryption failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // File loading and handling functions
  const loadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/*',
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const fileUri = result.assets[0].uri;
        const fileName = result.assets[0].name;
        
        setSelectedFileName(fileName);
        setCurrentFileUri(fileUri);
        
        try {
          // Check if file is encrypted by trying to read it as plain text first
          let fileContent;
          if (Platform.OS === 'web') {
            const response = await fetch(fileUri);
            fileContent = await response.text();
          } else {
            fileContent = await FileSystem.readAsStringAsync(fileUri);
          }
          
          // Try to determine if it's an encrypted file
          // (This is a simple heuristic - you might need a better way to detect encrypted content)
          if (fileContent.startsWith('U2F') || fileContent.includes('==') || /^[A-Za-z0-9+/=]+$/.test(fileContent)) {
            // Likely encrypted, prompt for decryption key
            setPendingFileUri(fileUri);
            setPasswordModalMode('decrypt');
            setPasswordModalVisible(true);
          } else {
            // Treat as plain text
            setFileContent(fileContent);
            setIsEdited(false);
            setIsSaved(true);
            setEncryptionKey('');  // Reset encryption key since it's plain text
            setError(null);
          }
        } catch (err) {
          console.error('Error reading file:', err);
          setError('Failed to read selected file');
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('File selection error:', err);
      setError('Failed to select file');
    }
  };

  // Modal control functions
// Modal control functions
const handleDecryptionKeySubmit = async (key: string) => {
  setPasswordModalVisible(false);
  
  if (!key || !pendingFileUri) {
    setError('Decryption key is required');
    setIsLoading(false);
    return;
  }
  
  setEncryptionKey(key);
  setIsLoading(true);
  
  try {
    // Read the encrypted content from the file
    let encryptedContent;
    
    if (Platform.OS === 'web') {
      const response = await fetch(pendingFileUri);
      encryptedContent = await response.text();
    } else {
      encryptedContent = await FileSystem.readAsStringAsync(pendingFileUri);
    }
    
    const decryptedContent = await decryptContent(encryptedContent, key);
    
    // Call the /open API with fileName and decryptedContent
    try {
      const openResponse = await axios.post('http://192.168.217.124:3000/open', {
        fileName: selectedFileName,
        decryptedContent: decryptedContent
      });
      
      // Use the latest content returned from the API
      if (openResponse.status === 200 && openResponse.data.latestContent) {
        setFileContent(openResponse.data.latestContent);
      } else {
        // If API doesn't return latest content, use the decrypted content
        setFileContent(decryptedContent);
      }
    } catch (openErr) {
      console.error('Failed to fetch latest content:', openErr);
      // If the API call fails, still show the decrypted content
      setFileContent(decryptedContent);
      // Optionally show a non-blocking warning
      Alert.alert('Warning', 'Loaded local file content. Failed to fetch latest version.');
    }
    
    setIsLoading(false);
    setIsEdited(false);
    setIsSaved(true);
    setError(null);
  } catch (err) {
    console.error('Decryption failed:', err);
    setError('Failed to decrypt file. Invalid key or corrupted file.');
    setIsLoading(false);
  }
};

  const handleDecryptionCancel = () => {
    setPasswordModalVisible(false);
    setError('Decryption key is required');
    setIsLoading(false);
  };

  // Content handling functions
  const handleContentChange = (text: string) => {
    setFileContent(text);
    setIsEdited(true);
    setIsSaved(false);
  };

  const saveFile = async () => {
    if (!currentFileUri) {
      setError('No file is currently open');
      return;
    }

    // If we need to encrypt the content before saving
    if (encryptionKey || passwordModalMode === 'encrypt') {
      if (!encryptionKey) {
        setPasswordModalMode('encrypt');
        setPasswordModalVisible(true);
      } else {
        performSave(encryptionKey);
      }
    } else {
      // Save as plain text if no encryption key is set
      performSavePlainText();
    }
  };
  
  const handleEncryptionKeySubmit = (key: string) => {
    setPasswordModalVisible(false);
    
    if (!key) {
      setError('Encryption key is required');
      return;
    }
    
    setEncryptionKey(key);
    performSave(key);
  };

  const performSave = async (key: string) => {
    if (!currentFileUri) {
      setError('No file is currently open');
      return;
    }

    try {
      setIsLoading(true);
      
      // Create a data structure with content and metadata
      const fileData = {
        content: fileContent,
        metadata: new Date().toISOString()
      };
      
      // Convert to string for encryption
      const jsonData = fileData;
      
      // Encrypt the content before saving
      const encryptedContent = await encryptContent(jsonData, key);
      
      // Save encrypted content back to the same file
      if (Platform.OS === 'web') {
        // For web, trigger a download of encrypted content
        const blob = new Blob([encryptedContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFileName || 'encrypted-document.txt';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        await FileSystem.writeAsStringAsync(currentFileUri, encryptedContent);
      }
      
      setIsEdited(false);
      setIsSaved(true);
      setError(null);
      Alert.alert('Success', 'File saved successfully');
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to save file:', err);
      setError(`Failed to save file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const performSavePlainText = async () => {
    if (!currentFileUri) {
      setError('No file is currently open');
      return;
    }

    try {
      setIsLoading(true);
      
      // Save content as plain text
      if (Platform.OS === 'web') {
        // For web, we need to use a different approach
        // This is a simplified version - in production you might need to use File API
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Create a link and trigger download (this is a common web pattern)
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFileName || 'document.txt';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        await FileSystem.writeAsStringAsync(currentFileUri, fileContent);
      }
      
      setIsEdited(false);
      setIsSaved(true);
      setError(null);
      Alert.alert('Success', 'File saved successfully');
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to save file:', err);
      setError(`Failed to save file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!currentFileUri) {
      setError('No file is currently open');
      return;
    }

    if (!isSaved && isEdited) {
      Alert.alert(
        'Unsaved Changes',
        'There are unsaved changes. Do you want to save before uploading?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Upload Without Saving', 
            onPress: () => performUpload() 
          },
          { 
            text: 'Save and Upload', 
            onPress: async () => {
              if (encryptionKey) {
                await performSave(encryptionKey);
              } else {
                await performSavePlainText();
              }
              performUpload();
            }
          },
        ]
      );
    } else {
      performUpload();
    }
  };

  const performUpload = async () => {
    try {
      setIsLoading(true);

      // Read the file content (could be plain or encrypted)
      let fileContent;
      if (Platform.OS === 'web') {
        const response = await fetch(currentFileUri!);
        fileContent = await response.text();
      } else {
        fileContent = await FileSystem.readAsStringAsync(currentFileUri!);
      }
      
      // Send the file to the upload API
      await axios.post(`http://192.168.217.124:3000/upload`, {
        fileName: selectedFileName,
        content: fileContent,
        isEncrypted: !!encryptionKey
      });

      setError(null);
      setIsLoading(false);
      Alert.alert('Success', 'File uploaded successfully');
    } catch (err) {
      console.error('Failed to upload file:', err);
      setError('Failed to upload file. Please try again.');
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      await axios.post(`http://192.168.217.124:3000/disconnect`);
      navigation.navigate('Connect');
    }
    catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Encrypted File Editor</Text>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {error && <Text style={styles.errorMessage}>{error}</Text>}

        <View style={styles.fileInfo}>
          {selectedFileName && (
            <Text style={styles.currentFile}>Current file: {selectedFileName}</Text>
          )}
        </View>

        <View style={styles.editorContainer}>
          <TextInput
            style={styles.fileEditor}
            value={fileContent}
            onChangeText={handleContentChange}
            editable={!isLoading}
            placeholder="Open a file to edit its content..."
            multiline={true}
            numberOfLines={10}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.openButton]}
            onPress={loadFile}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Open File</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton, (!currentFileUri || (!fileContent && !isEdited)) ? styles.disabledButton : null]}
            onPress={saveFile}
            disabled={isLoading || !currentFileUri || (!fileContent && !isEdited)}
          >
            <Text style={styles.buttonText}>Save File</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.uploadButton, (!currentFileUri) ? styles.disabledButton : null]}
            onPress={uploadFile}
            disabled={isLoading || !currentFileUri}
          >
            <Text style={styles.buttonText}>Upload</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.disconnectButton]}
            onPress={disconnect}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PasswordPromptModal
        isVisible={passwordModalVisible}
        mode={passwordModalMode}
        onSubmit={passwordModalMode === 'decrypt' ? 
          handleDecryptionKeySubmit : 
          handleEncryptionKeySubmit}
        onCancel={handleDecryptionCancel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorMessage: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  fileInfo: {
    marginVertical: 10,
  },
  currentFile: {
    fontSize: 16,
    fontWeight: '500',
  },
  editorContainer: {
    marginVertical: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  fileEditor: {
    padding: 12,
    minHeight: 300,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: '45%',
    alignItems: 'center',
  },
  openButton: {
    backgroundColor: '#2196F3',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  uploadButton: {
    backgroundColor: '#FF9800',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomePage;