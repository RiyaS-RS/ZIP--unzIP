import os
import zipfile
from google.cloud import storage
from google.cloud import firestore

def unzip_file(event, context):
    file_data = event
    file_name = file_data['name']
    bucket_name = file_data['bucket']

    if not file_name.endswith('.zip'):
        print(f"The file {file_name} is not a zip file.")
        return

    client = storage.Client()
    bucket = client.get_bucket(bucket_name)
    zip_blob = bucket.blob(file_name)

    temp_dir = '/tmp/unzipped'
    os.makedirs(temp_dir, exist_ok=True)

    temp_zip_path = os.path.join(temp_dir, file_name)
    zip_blob.download_to_filename(temp_zip_path)

    with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)

    for root, dirs, files in os.walk(temp_dir):
        for file in files:
            if file != file_name:  # Skip the original zip file
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, temp_dir)
                new_blob = bucket.blob(relative_path)
                new_blob.upload_from_filename(file_path)
                print(f"Uploaded: {relative_path}")

    try:
        zip_blob.delete()
        print(f"Deleted original zip file: {file_name}")
    except Exception as e:
        print(f"Error deleting zip file {file_name}: {str(e)}")

    db = firestore.Client()
    files_ref = db.collection('files')
    docs = files_ref.where('name', '==', file_name).stream()
    for doc in docs:
        doc.reference.delete()
    print(f"Deleted {file_name} from database")

    for root, dirs, files in os.walk(temp_dir, topdown=False):
        for file in files:
            os.remove(os.path.join(root, file))
        for dir in dirs:
            os.rmdir(os.path.join(root, dir))
    os.rmdir(temp_dir)

    print(f"Unzipped {file_name} and uploaded files to {bucket_name}")