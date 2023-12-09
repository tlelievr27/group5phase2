import { useAuth } from "../components/AuthContext";
export const UpdatePkg = async (pkgData: { Name: string, Version: string, ID: string, value: string, type: 'url' | 'content' }, TOKEN: string) => {
    try {
        const response = await fetch(`http://127.0.0.1:3000/packages/${pkgData.ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'authorization': TOKEN,
            },
            body: JSON.stringify({
                metadata: {
                    Name: pkgData.Name,
                    Version: pkgData.Version,
                    ID: pkgData.ID,
                },
                data: {
                    [pkgData.type]: pkgData.value,
                }
            }),
        });

        if (!response.ok) {
            console.error('Error in API call 1:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error in API call 1:', error);
        return null;
    }
};
