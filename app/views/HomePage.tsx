import PasswordPromptModal from '@/components/PasswrodPromptModal';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
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
  const [selectedFileName, setSelectedFileName] = useState<string>('data.txt');
  
  // State for modal control
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  const [passwordModalMode, setPasswordModalMode] = useState<'decrypt' | 'encrypt'>('decrypt');
  const [pendingEncryptedContent, setPendingEncryptedContent] = useState<string | null>(null);
  const [pendingFileUri, setPendingFileUri] = useState<string | null>(null);

  const navigation = useNavigation<any>();

  useEffect(() => {
    getEncryptedTestValue();
    loadDefaultFile();
  }, []);

  // API-based encryption function
  const encryptContent = async (content: string, password: string): Promise<string> => {
    try {
      const response = await axios.post('http://192.168.217.186:3000/encrypt', {
        data: content,
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
      const response = await axios.post('http://192.168.217.186:3000/decrypt', {
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

  // Function to test encryption/decryption
  const getEncryptedTestValue = async () => {
    try {
      const testMessage = 'Hi';
      const testPassword = 'aaaaaa';
      
      const encryptedValue = await encryptContent(testMessage, testPassword);
      console.log('Encrypted value of "Hi" with password "aaaaaa":', encryptedValue);
      
      // Verify it works by decrypting
      const decrypted = await decryptContent(encryptedValue, testPassword);
      console.log('Decrypted back:', decrypted);
      
      return encryptedValue;
    } catch (error) {
      console.error('Encryption test failed:', error);
      return null;
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
        setSelectedFileName(result.assets[0].name);
        promptForKeyAndDecrypt(result.assets[0].uri);
      }
    } catch (err) {
      console.error('File selection error:', err);
      setError('Failed to select file');
    }
  };

  const loadDefaultFile = async () => {
    try {
      setIsLoading(true);

      try {
        const response = await axios.post(`http://192.168.217.186:3000/open`);
        const encryptedContent = response.data.content;

        promptUserForKeyAndDecrypt(encryptedContent);
      } catch (err) {
        console.error('Failed to load from API, falling back to file input');
        setError('Could not load default file automatically. Please select it manually.');
        setIsLoading(false);

        // Show alert to ask user to select file manually
        Alert.alert(
          'Default File Not Available',
          'Could not load default file. Would you like to select a file?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Select File', onPress: loadFile },
          ]
        );
      }
    } catch (err) {
      console.error('Failed to load default file:', err);
      setError(`Failed to load default file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  // Modal control functions
  const promptUserForKeyAndDecrypt = (encryptedContent: string) => {
    console.log('Encrypted content:', encryptedContent);
    setPendingEncryptedContent(encryptedContent);
    setPasswordModalMode('decrypt');
    setPasswordModalVisible(true);
  };

  const handleDecryptionKeySubmit = async (key: string) => {
    setPasswordModalVisible(false);
    
    if (!key || !pendingEncryptedContent) {
      setError('Decryption key is required');
      setIsLoading(false);
      return;
    }
    
    setEncryptionKey(key);
    
    try {
      const decryptedContent = await decryptContent(pendingEncryptedContent, key);
      setFileContent(decryptedContent);
      setIsLoading(false);
      setIsEdited(false);
      setIsSaved(false);
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

  const promptForKeyAndDecrypt = async (fileUri: string) => {
    setPendingFileUri(fileUri);
    setPasswordModalMode('decrypt');
    setPasswordModalVisible(true);
  };
  
  const handleFileDecryptionSubmit = async (key: string) => {
    setPasswordModalVisible(false);
    
    if (!key || !pendingFileUri) {
      setError('Decryption key is required');
      return;
    }
    
    setEncryptionKey(key);
    setIsLoading(true);
    
    try {
      let encryptedContent;
      
      if (Platform.OS === 'web') {
        // For web, use fetch API to read file content
        const response = await fetch(pendingFileUri);
        encryptedContent = await response.text();
      } else {
        // For native platforms, use FileSystem
        encryptedContent = await FileSystem.readAsStringAsync(pendingFileUri);
      }
      const decryptedContent = await decryptContent(encryptedContent, key);
      setFileContent(decryptedContent);
      setIsLoading(false);
      setIsEdited(false);
      setIsSaved(false);
      setError(null);
    } catch (err) {
      console.error('Decryption failed:', err);
      setError('Failed to decrypt file. Invalid key or corrupted file.');
      setIsLoading(false);
    }
  };

  // Content handling functions
  const handleContentChange = (text: string) => {
    setFileContent(text);
    setIsEdited(true);
    setIsSaved(false);
  };

  const saveFile = async () => {
    if (!encryptionKey) {
      setPasswordModalMode('encrypt');
      setPasswordModalVisible(true);
    } else {
      performSave(encryptionKey);
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
    try {
      setIsLoading(true);
      
      // Encrypt the content before saving
      const encryptedContent = await encryptContent(fileContent, key);
      
      // Send the encrypted content to API
      const response = await axios.post(`http://192.168.217.186:3000/save`, {
        content: encryptedContent,
      });
      
      if (response.status === 200) {
        setIsEdited(false);
        setIsSaved(true);
        setError(null);
        Alert.alert('Success', 'File saved successfully');
      } else {
        throw new Error('Failed to save file');
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to save file:', err);
      setError(`Failed to save file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!encryptionKey) {
      setError('Encryption key is required');
      return;
    }

    try {
      setIsLoading(true);

      await axios.post(`http://192.168.217.186:3000/upload`);

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
      await axios.post(`http://192.168.217.186:3000/disconnect`);
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
            placeholder="Open an encrypted file or create new content..."
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
            style={[styles.button, styles.saveButton]}
            onPress={saveFile}
            disabled={isLoading || (!fileContent && !isEdited)}
          >
            <Text style={styles.buttonText}>Save File</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.uploadButton]}
            onPress={uploadFile}
            disabled={isLoading || !fileContent}
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
          (pendingFileUri ? handleFileDecryptionSubmit : handleDecryptionKeySubmit) : 
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
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomePage;