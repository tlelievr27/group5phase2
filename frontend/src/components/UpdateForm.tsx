import React, { useState, FormEvent } from 'react';
import { UpdatePkg } from '../API/UpdatePkg';
import { useAuth } from './AuthContext';

interface UpdateFormProps {
  onClose: () => void;
  Name: string;
  ID: string;
  Version: string;
}

const UpdateForm: React.FC<UpdateFormProps> = ({ onClose, Name, ID, Version }) => {
  const [updateOption, setUpdateOption] = useState<'URL' | 'Content'>('URL');
  const [updateInput, setUpdateInput] = useState<string>('');
  const [isUpdateButtonFocused, setIsUpdateButtonFocused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { authResult } = useAuth();
  const authResult1 = authResult ? authResult.replaceAll("\"", "") : '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      if (updateOption && updateInput) {
        const response = await UpdatePkg({ Name, Version, ID, value: updateInput, type: updateOption }, authResult1);

        if (response !== null) {
          console.log('Update API Response:', response);
        } else {
          console.error('Error in Update API call:', 'Failed to update package.');
          setError('Failed to update package. Please try again.');
        }
      } else {
        console.error('Error in Update API call:', 'Please select an update option and provide the required input.');
        setError('Please select an update option and provide the required input.');
      }
    } catch (error) {
      console.error('Error in Update API call:', error);
      setError('An error occurred during the update. Please try again.');
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-8 rounded-md shadow-md z-50">
      <h2 className="text-2xl font-bold mb-4">Update Options</h2>

      <form onSubmit={handleSubmit}>
        <label className="block mb-4">
          <input
            type="radio"
            value="url"
            checked={updateOption === 'URL'}
            onChange={() => setUpdateOption('URL')}
          />
          Update with URL
        </label>

        <label className="block mb-4">
          <input
            type="radio"
            value="content"
            checked={updateOption === 'Content'}
            onChange={() => setUpdateOption('Content')}
          />
          Update with Content
        </label>

        {updateOption === 'URL' && (
          <label className="block mb-4">
            URL:
            <input
              type="text"
              value={updateInput}
              onChange={(e) => setUpdateInput(e.target.value)}
              className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:border-blue-500"
            />
          </label>
        )}

        {updateOption === 'Content' && (
          <label className="block mb-4">
            Content:
            <textarea
              value={updateInput}
              onChange={(e) => setUpdateInput(e.target.value)}
              className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:border-blue-500"
            ></textarea>
          </label>
        )}

        {error && (
          <div role="alert" className="text-red-600 mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className={`bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:shadow-outline-blue ${isUpdateButtonFocused ? 'focus-visible' : ''}`}
            onFocus={() => setIsUpdateButtonFocused(true)}
            onBlur={() => setIsUpdateButtonFocused(false)}
          >
            Update
          </button>
          <button
            onClick={onClose}
            className="ml-4 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:shadow-outline-gray"
          >
            Close
          </button>
        </div>
      </form>
    </div>
  );
};

export default UpdateForm;
